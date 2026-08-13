import { z } from "zod"

import { entityIdSchema, type EntityStatus } from "@/domain/common"

export const serviceTypeSchema = z.enum(["internal", "external"])
export const httpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
])

const serviceCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[a-z]+(?:-[a-z]+)*$/)
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

export const endpointFieldLocationSchema = z.enum([
  "path",
  "query",
  "header",
  "request-body",
  "response-body",
])
export const endpointFieldValueTypeSchema = z.enum([
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
])
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
  code: serviceCodeSchema,
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
export const serviceTypes: ServiceType[] = ["internal", "external"]
export const httpMethods: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]

export type ServiceInput = z.infer<typeof serviceInputSchema>
export type ServiceEndpointInput = z.infer<typeof serviceEndpointInputSchema>
export type ServiceEndpointFieldInput = z.infer<
  typeof serviceEndpointFieldInputSchema
>

export type ManagedService = ServiceInput & {
  id: string
  status: EntityStatus
  createdAt: string
}

export type ServiceEndpoint = Omit<ServiceEndpointInput, "fields"> & {
  id: string
  createdAt: string
}

export type ServiceEndpointField = ServiceEndpointFieldInput & {
  id: string
  endpointId: string
  createdAt: string
}
