import { z } from "zod"

import { entityIdSchema, type EntityStatus } from "@/domain/common"

export const serviceTypeValues = {
  internal: "internal",
  external: "external",
} as const
export const httpMethodValues = {
  get: "GET",
  post: "POST",
  put: "PUT",
  patch: "PATCH",
  delete: "DELETE",
} as const
export const endpointLifecycleValues = {
  active: "active",
  deprecated: "deprecated",
} as const
export const endpointVersionInputPattern = "[A-Za-z0-9][A-Za-z0-9._\\-]*"
export const endpointFieldLocationValues = {
  path: "path",
  query: "query",
  header: "header",
  requestBody: "request-body",
  responseBody: "response-body",
} as const
export const endpointRequestParameterLocations = [
  endpointFieldLocationValues.path,
  endpointFieldLocationValues.query,
  endpointFieldLocationValues.header,
] as const
export function isEndpointRequestParameterLocation(
  value: unknown,
): value is (typeof endpointRequestParameterLocations)[number] {
  return endpointRequestParameterLocations.some(
    (candidate) => candidate === value,
  )
}
export const endpointFieldValueTypeValues = {
  string: "string",
  number: "number",
  integer: "integer",
  boolean: "boolean",
  array: "array",
  object: "object",
} as const
export const serviceTypeSchema = z.enum(serviceTypeValues)
export const httpMethodSchema = z.enum(httpMethodValues)
export const endpointLifecycleSchema = z.enum(endpointLifecycleValues)

export const serviceKeyInputPattern = "[a-z]+(?:-[a-z]+)*"

export function filterServiceKeyInput(value: string) {
  return value.replace(/[^a-z-]/g, "")
}

const serviceKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(new RegExp(`^${serviceKeyInputPattern}$`))
const serviceHostSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value)
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash &&
        !url.username &&
        !url.password
      )
    } catch {
      return false
    }
  })
const endpointPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^\/(?!\/)[^?#\s]*$/)

export const endpointFieldLocationSchema = z.enum(endpointFieldLocationValues)
export const endpointFieldValueTypeSchema = z.enum(endpointFieldValueTypeValues)
const endpointFieldPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^\$(?:\.[A-Za-z_][A-Za-z0-9_]*|\['[^'\\]+'\]|\[(?:0|[1-9]\d*)\])+$/)

export const serviceEndpointFieldInputSchema = z.object({
  location: endpointFieldLocationSchema,
  fieldPath: endpointFieldPathSchema,
  valueType: endpointFieldValueTypeSchema,
  required: z.boolean(),
  description: z.string().trim().max(300),
})

export const serviceInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  serviceKey: serviceKeySchema,
  host: serviceHostSchema,
  type: serviceTypeSchema,
  ownerOrganizationId: entityIdSchema,
  credentialTemplateIds: z.object({
    issuance: entityIdSchema,
    replacement: entityIdSchema,
    disposal: entityIdSchema,
  }),
})

export const serviceEndpointInputSchema = z
  .object({
    serviceId: entityIdSchema,
    name: z.string().trim().min(2).max(100),
    method: httpMethodSchema,
    path: endpointPathSchema,
    version: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
      .default("v1"),
    lifecycle: endpointLifecycleSchema.default(endpointLifecycleValues.active),
    fields: z.array(serviceEndpointFieldInputSchema).max(300),
  })
  .refine(
    (endpoint) =>
      new Set(
        endpoint.fields.map(
          (field) => `${field.location}\u0000${field.fieldPath}`,
        ),
      ).size === endpoint.fields.length,
    { path: ["fields"] },
  )

export type ServiceType = z.infer<typeof serviceTypeSchema>
export type HttpMethod = z.infer<typeof httpMethodSchema>
export type EndpointLifecycle = z.infer<typeof endpointLifecycleSchema>
export type EndpointFieldValueType = z.infer<
  typeof endpointFieldValueTypeSchema
>
export const serviceTypes: ServiceType[] = [
  serviceTypeValues.internal,
  serviceTypeValues.external,
]
export const httpMethods: HttpMethod[] = [...Object.values(httpMethodValues)]

export type ServiceInput = z.infer<typeof serviceInputSchema>
export type ServiceEndpointInput = z.input<typeof serviceEndpointInputSchema>
export type ServiceEndpointValue = z.output<typeof serviceEndpointInputSchema>
export type ServiceEndpointFieldInput = z.infer<
  typeof serviceEndpointFieldInputSchema
>

export type ManagedService = ServiceInput & {
  id: string
  status: EntityStatus
  createdAt: string
}

export type ServiceEndpoint = Omit<
  z.output<typeof serviceEndpointInputSchema>,
  "fields"
> & {
  id: string
  createdAt: string
}

export type ServiceEndpointField = ServiceEndpointFieldInput & {
  id: string
  endpointId: string
  createdAt: string
}

export type ServiceEndpointRevision = {
  id: string
  endpointId: string
  version: string
  endpoint: ServiceEndpoint
  fields: ServiceEndpointField[]
  createdAt: string
}
