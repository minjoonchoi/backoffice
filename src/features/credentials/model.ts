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

export const credentialLifecycleSettingsInputSchema = z
  .object({
    expirationPeriodDays: z.number().int().min(1).max(3650),
    rotationIntervalDays: z.number().int().min(1).max(365),
  })
  .refine((value) => value.rotationIntervalDays < value.expirationPeriodDays, {
    path: ["rotationIntervalDays"],
  })

export const apiKeyEmergencyRevokeInputSchema = z.object({
  apiKeyId: entityIdSchema,
  requesterId: entityIdSchema,
  reason: z.string().trim().min(10).max(500),
})

export type ApiKey = {
  id: string
  name: string
  applicationId: string
  accessPolicyId: string | null
  serviceId: string
  endpointIds: string[]
  approvalDocumentId: string
  replacesApiKeyId: string | null
  registeredByUserId: string | null
  awsSecretName: string
  awsSecretKey: string
  expiresAt: string | null
  nextRotationAt: string | null
  usageSystemNames: string[]
  emergencyRevokedAt: string | null
  emergencyRevokeReason: string | null
  status: EntityStatus
  createdAt: string
}

export type ApiKeyRegistrationInput = z.infer<
  typeof apiKeyRegistrationInputSchema
>
export type CredentialLifecycleSettingsInput = z.infer<
  typeof credentialLifecycleSettingsInputSchema
>
export type CredentialLifecycleSettings = CredentialLifecycleSettingsInput & {
  updatedAt: string
  updatedByUserId: string | null
}
export type ApiKeyEmergencyRevokeInput = z.infer<
  typeof apiKeyEmergencyRevokeInputSchema
>
export type ApiKeyRegistration = {
  apiKey: ApiKey
  secret: string | null
}
