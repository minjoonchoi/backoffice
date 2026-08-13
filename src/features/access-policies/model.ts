import { z } from "zod"

import { entityIdSchema, type EntityStatus } from "@/domain/common"
import {
  awsSecretKeySchema,
  awsSecretNameSchema,
} from "@/features/credentials/model"
import {
  approvalTypeSchema,
  type ApprovalType,
  type ResolvedApprovalStep,
} from "@/features/request-templates/model"

export const accessPolicyEffectSchema = z.enum(["allow", "deny"])
export const accessPolicyTypeSchema = z.enum(["access-grant"])
export const accessPolicyResourceTypeSchema = z.enum([
  "endpoint",
  "ui-namespace",
  "ui-resource",
])
export const accessPolicyAssignmentTargetSchema = z.enum([
  "user",
  "organization",
  "role",
  "group",
])

export const accessPolicyResourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("endpoint"), id: entityIdSchema }),
  z.object({ type: z.literal("ui-namespace"), id: entityIdSchema }),
  z.object({ type: z.literal("ui-resource"), id: entityIdSchema }),
])

export const accessPolicyInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(2).max(500),
  type: accessPolicyTypeSchema,
  effect: accessPolicyEffectSchema,
  resources: z
    .array(accessPolicyResourceSchema)
    .min(1)
    .max(2000)
    .refine(
      (resources) =>
        new Set(resources.map((resource) => `${resource.type}:${resource.id}`))
          .size === resources.length,
      { path: ["resources"] },
    ),
})

const approvalDocumentBaseSchema = z.object({
  title: z.string().trim().min(2).max(160),
  type: approvalTypeSchema,
  organizationId: entityIdSchema,
  requesterId: entityIdSchema,
  approvalLineId: entityIdSchema,
  content: z.string().trim().min(10).max(5000),
  fieldValues: z
    .array(z.object({ fieldId: entityIdSchema, value: z.string().max(5000) }))
    .max(30)
    .refine(
      (values) =>
        new Set(values.map((value) => value.fieldId)).size === values.length,
    ),
  stepAssignments: z.array(
    z.object({ stepId: entityIdSchema, userId: entityIdSchema }),
  ),
  submission: z.enum(["draft", "submitted"]),
})

const credentialEndpointIdsSchema = z
  .array(entityIdSchema)
  .max(100)
  .refine((values) => new Set(values).size === values.length)

const generalApprovalDocumentInputSchema = z.discriminatedUnion("type", [
  approvalDocumentBaseSchema.extend({
    documentKind: z.literal("general"),
    type: z.literal("access-grant"),
    accessPolicyId: entityIdSchema,
  }),
  approvalDocumentBaseSchema.extend({
    documentKind: z.literal("general"),
    type: z.enum(["resource-create", "access-revoke", "resource-dispose"]),
  }),
])

export const approvalDocumentInputSchema = z.union([
  generalApprovalDocumentInputSchema,
  approvalDocumentBaseSchema.extend({
    documentKind: z.literal("api-key-issuance"),
    type: z.literal("api-key"),
    serviceId: entityIdSchema,
    endpointIds: credentialEndpointIdsSchema,
    keyName: z.string().trim().min(2).max(80),
    awsSecretName: awsSecretNameSchema,
    awsSecretKey: awsSecretKeySchema,
  }),
  approvalDocumentBaseSchema.extend({
    documentKind: z.literal("api-key-lifecycle"),
    type: z.literal("api-key-replace"),
    apiKeyId: entityIdSchema,
    awsSecretName: awsSecretNameSchema,
    awsSecretKey: awsSecretKeySchema,
  }),
  approvalDocumentBaseSchema.extend({
    documentKind: z.literal("api-key-lifecycle"),
    type: z.literal("api-key-dispose"),
    apiKeyId: entityIdSchema,
  }),
])

export type AccessPolicyEffect = z.infer<typeof accessPolicyEffectSchema>
export type AccessPolicyType = z.infer<typeof accessPolicyTypeSchema>
export type AccessPolicyResourceType = z.infer<
  typeof accessPolicyResourceTypeSchema
>
export type AccessPolicyAssignmentTarget = z.infer<
  typeof accessPolicyAssignmentTargetSchema
>
export type AccessPolicyInput = z.infer<typeof accessPolicyInputSchema>
export type AccessPolicyResource = z.infer<typeof accessPolicyResourceSchema>
export type ApprovalDocumentInput = z.infer<typeof approvalDocumentInputSchema>

export type AccessPolicy = AccessPolicyInput & {
  id: string
  status: EntityStatus
  createdAt: string
}
export type AccessPolicyAssignment = {
  id: string
  accessPolicyId: string
  targetType: AccessPolicyAssignmentTarget
  targetId: string
  createdAt: string
}
type StoredApprovalDocumentInput<
  Input extends ApprovalDocumentInput = ApprovalDocumentInput,
> = Input extends ApprovalDocumentInput
  ? Omit<Input, "submission" | "stepAssignments">
  : never

export type ApprovalDocument = StoredApprovalDocumentInput & {
  id: string
  status: "draft" | "submitted" | "approved"
  createdAt: string
  approvalSteps: ResolvedApprovalStep[]
}
export type ApprovalCompletion = { document: ApprovalDocument }

export function isCredentialApprovalType(type: ApprovalType) {
  return (
    type === "api-key" ||
    type === "api-key-replace" ||
    type === "api-key-dispose"
  )
}
