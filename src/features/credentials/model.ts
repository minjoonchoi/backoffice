import { z } from "zod"

import {
  backofficeErrorCodes,
  entityIdSchema,
  type EntityStatus,
} from "@/domain/common"

export const credentialRegistrationAttemptStatuses = {
  succeeded: "succeeded",
  failed: "failed",
} as const
export const credentialRegistrationAttemptStatusSchema = z.enum(
  credentialRegistrationAttemptStatuses,
)

export const awsSecretNameInputPattern = "[A-Za-z0-9_+=.@\\/\\-]+"
export const awsSecretKeyInputPattern = "[A-Za-z0-9_.\\-]+"

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

export const credentialRegistrationAttemptSchema = z
  .object({
    id: entityIdSchema,
    approvalDocumentId: entityIdSchema,
    serviceId: entityIdSchema,
    registeredByUserId: entityIdSchema,
    apiKeyId: entityIdSchema.nullable(),
    attemptNumber: z.number().int().min(1).max(1000),
    status: credentialRegistrationAttemptStatusSchema,
    errorCode: z
      .literal(backofficeErrorCodes.internalCredentialRegistrationFailed)
      .nullable(),
    createdAt: z.iso.datetime(),
  })
  .refine(
    (attempt) =>
      attempt.status === credentialRegistrationAttemptStatuses.succeeded
        ? attempt.apiKeyId !== null && attempt.errorCode === null
        : attempt.apiKeyId === null && attempt.errorCode !== null,
    { path: ["status"] },
  )

export type CredentialRegistrationAttempt = z.infer<
  typeof credentialRegistrationAttemptSchema
>

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
export type ApiKeyRegistration =
  | Readonly<{
      status: typeof credentialRegistrationAttemptStatuses.succeeded
      attempt: CredentialRegistrationAttempt
      apiKey: ApiKey
      secret: string | null
    }>
  | Readonly<{
      status: typeof credentialRegistrationAttemptStatuses.failed
      attempt: CredentialRegistrationAttempt
      apiKey: null
      secret: null
      error: typeof backofficeErrorCodes.internalCredentialRegistrationFailed
    }>
