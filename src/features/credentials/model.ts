import { z } from "zod"

import { entityIdSchema, type EntityStatus } from "@/domain/common"

export const awsSecretNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .regex(/^[A-Za-z0-9/_+=.@-]+$/)
export const awsSecretKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_.-]+$/)
export const apiKeySecretSchema = z.string().min(8).max(4096)
export const apiKeyRegistrationInputSchema = z.object({
  approvalDocumentId: entityIdSchema,
  registeredByUserId: entityIdSchema,
  secret: apiKeySecretSchema.optional(),
})

export type ApiKey = {
  id: string
  name: string
  serviceId: string
  endpointIds: string[]
  approvalDocumentId: string
  replacesApiKeyId: string | null
  registeredByUserId: string | null
  awsSecretName: string
  awsSecretKey: string
  status: EntityStatus
  createdAt: string
}

export type ApiKeyRegistrationInput = z.infer<
  typeof apiKeyRegistrationInputSchema
>
export type ApiKeyRegistration = {
  apiKey: ApiKey
  secret: string | null
}
