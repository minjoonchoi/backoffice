import { parseDocument } from "yaml"
import { z } from "zod"

import { endpointFieldValueTypeSchema } from "@/features/service-catalog/model"
import type {
  EndpointLifecycle,
  EndpointFieldValueType,
  HttpMethod,
  ServiceEndpointFieldInput,
  ServiceEndpointInput,
} from "@/features/service-catalog/model"
import {
  endpointFieldLocationValues,
  endpointLifecycleValues,
  httpMethodValues,
  isEndpointRequestParameterLocation,
} from "@/features/service-catalog/model"

const openApiSourceSchema = z.string().trim().min(2).max(2_000_000)
const recordSchema = z.record(z.string(), z.unknown())
const supportedMethods = new Map<string, HttpMethod>([
  ["get", httpMethodValues.get],
  ["post", httpMethodValues.post],
  ["put", httpMethodValues.put],
  ["patch", httpMethodValues.patch],
  ["delete", httpMethodValues.delete],
])

export type OpenApiImportPreview = Readonly<{
  title: string
  version: string
  endpoints: readonly (ServiceEndpointInput & {
    version: string
    lifecycle: EndpointLifecycle
  })[]
}>

function asRecord(value: unknown): Record<string, unknown> | null {
  const result = recordSchema.safeParse(value)
  return result.success ? result.data : null
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null
}

function schemaType(value: unknown): EndpointFieldValueType {
  const record = asRecord(value)
  const result = endpointFieldValueTypeSchema.safeParse(record?.type)
  return result.success ? result.data : "object"
}

function resolveSchema(
  schema: unknown,
  document: Record<string, unknown>,
): Record<string, unknown> | null {
  const record = asRecord(schema)
  if (!record) return null
  const reference = readString(record.$ref)
  if (!reference?.startsWith("#/")) return record
  const resolved = reference
    .slice(2)
    .split("/")
    .reduce<unknown>(
      (current, segment) => asRecord(current)?.[segment],
      document,
    )
  return asRecord(resolved)
}

function jsonPath(parent: string, key: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
    ? `${parent}.${key}`
    : `${parent}['${key.replaceAll("'", "")}']`
}

function flattenBodySchema(
  schema: unknown,
  document: Record<string, unknown>,
  location:
    | typeof endpointFieldLocationValues.requestBody
    | typeof endpointFieldLocationValues.responseBody,
  parentPath = "$",
  required = false,
): ServiceEndpointFieldInput[] {
  const resolved = resolveSchema(schema, document)
  if (!resolved) return []
  const properties = asRecord(resolved.properties)
  const requiredKeys = new Set(
    Array.isArray(resolved.required)
      ? resolved.required.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
  )
  const current =
    parentPath === "$"
      ? []
      : [
          {
            location,
            fieldPath: parentPath,
            valueType: schemaType(resolved),
            required,
            description: readString(resolved.description) ?? "",
          } satisfies ServiceEndpointFieldInput,
        ]
  if (!properties) return current
  return [
    ...current,
    ...Object.entries(properties).flatMap(([key, value]) =>
      flattenBodySchema(
        value,
        document,
        location,
        jsonPath(parentPath, key),
        requiredKeys.has(key),
      ),
    ),
  ]
}

function contentSchema(content: unknown) {
  const record = asRecord(content)
  if (!record) return null
  const preferred = asRecord(record["application/json"])
  const first = preferred ?? asRecord(Object.values(record)[0])
  return first?.schema
}

function parameterFields(parameters: unknown): ServiceEndpointFieldInput[] {
  if (!Array.isArray(parameters)) return []
  return parameters.flatMap((parameter) => {
    const record = asRecord(parameter)
    const name = record ? readString(record.name) : null
    const location = record ? readString(record.in) : null
    if (!record || !name || !isEndpointRequestParameterLocation(location)) {
      return []
    }
    return [
      {
        location:
          location === endpointFieldLocationValues.path
            ? endpointFieldLocationValues.path
            : location === endpointFieldLocationValues.query
              ? endpointFieldLocationValues.query
              : endpointFieldLocationValues.header,
        fieldPath: jsonPath("$", name),
        valueType: schemaType(record.schema),
        required:
          record.required === true ||
          location === endpointFieldLocationValues.path,
        description: readString(record.description) ?? "",
      } satisfies ServiceEndpointFieldInput,
    ]
  })
}

function responseBodyFields(
  responses: unknown,
  document: Record<string, unknown>,
) {
  const record = asRecord(responses)
  if (!record) return []
  const success = Object.entries(record).find(([status]) =>
    /^2\d\d$/.test(status),
  )
  const response = asRecord(success?.[1])
  return flattenBodySchema(
    contentSchema(response?.content),
    document,
    endpointFieldLocationValues.responseBody,
  )
}

function deduplicateFields(fields: readonly ServiceEndpointFieldInput[]) {
  const fieldsByPath = new Map<string, ServiceEndpointFieldInput>()
  for (const field of fields) {
    fieldsByPath.set(`${field.location}\u0000${field.fieldPath}`, field)
  }
  return [...fieldsByPath.values()]
}

export function parseOpenApiEndpoints(
  source: string,
  serviceId: string,
): OpenApiImportPreview {
  const parsedSource = openApiSourceSchema.parse(source)
  const document = parseDocument(parsedSource, {
    merge: false,
    uniqueKeys: true,
  })
  if (document.errors.length > 0) {
    throw new SyntaxError(
      document.errors.map((error) => error.message).join("\n"),
    )
  }
  const rawDocument: unknown = document.toJS({ maxAliasCount: 0 })
  const root = recordSchema.parse(rawDocument)
  const info = asRecord(root.info)
  const title = readString(info?.title) ?? "OpenAPI"
  const version = readString(info?.version) ?? "v1"
  const paths = recordSchema.parse(root.paths)
  const endpoints = Object.entries(paths).flatMap(([path, pathValue]) => {
    const pathRecord = asRecord(pathValue)
    if (!pathRecord) return []
    const sharedParameters = parameterFields(pathRecord.parameters)
    return [...supportedMethods].flatMap(([methodKey, method]) => {
      const operation = asRecord(pathRecord[methodKey])
      if (!operation) return []
      const requestBody = asRecord(operation.requestBody)
      const fields = deduplicateFields([
        ...sharedParameters,
        ...parameterFields(operation.parameters),
        ...flattenBodySchema(
          contentSchema(requestBody?.content),
          root,
          endpointFieldLocationValues.requestBody,
        ),
        ...responseBodyFields(operation.responses, root),
      ])
      return [
        {
          serviceId,
          name:
            readString(operation.summary) ??
            readString(operation.operationId) ??
            `${method} ${path}`,
          method,
          path,
          version,
          lifecycle:
            operation.deprecated === true
              ? endpointLifecycleValues.deprecated
              : endpointLifecycleValues.active,
          fields,
        } satisfies ServiceEndpointInput,
      ]
    })
  })
  if (endpoints.length === 0) throw new Error("openapi-endpoints-empty")
  return { title, version, endpoints }
}
