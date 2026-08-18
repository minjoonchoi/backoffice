import { approvalStepKindValues } from "@/features/request-templates/model"
import { z } from "zod"

import { entityIdSchema, type EntityStatus } from "@/domain/common"
import {
  awsSecretKeySchema,
  awsSecretNameSchema,
} from "@/features/credentials/model"
import {
  approvalExecutionTypeValues,
  approvalStepKindSchema,
  approvalTypeSchema,
  approvalTypeValues,
  grooDocumentIdSchema,
  type ApprovalType,
  type ResolvedApprovalStep,
} from "@/features/request-templates/model"

export const accessPolicyEffects = { allow: "allow", deny: "deny" } as const
export const accessPolicyTypes = { accessGrant: "access-grant" } as const
export const accessPolicyManagementTypes = {
  general: "general",
  system: "system",
} as const
export const accessPolicyResourceTypes = {
  endpoint: "endpoint",
  uiResource: "ui-resource",
} as const
export const accessPolicyAssignmentTargets = {
  user: "user",
  organization: "organization",
  role: "role",
  application: "application",
} as const
export const approvalDocumentKinds = {
  general: "general",
  apiKeyIssuance: "api-key-issuance",
  apiKeyLifecycle: "api-key-lifecycle",
} as const
export const approvalDocumentStatuses = {
  draft: "draft",
  submitted: "submitted",
  approved: "approved",
  rejected: "rejected",
  withdrawn: "withdrawn",
} as const
export const approvalStepStatuses = {
  waiting: "waiting",
  pending: "pending",
  completed: "completed",
  rejected: "rejected",
} as const
export const approvalDocumentSubmissions = {
  draft: "draft",
  submitted: "submitted",
} as const
export const approvalDecisions = {
  approve: "approve",
  reject: "reject",
  acknowledge: "acknowledge",
} as const
export const approvalAssigneeTypes = {
  user: "user",
  organization: "organization",
} as const
export const approvalDocumentHistoryEventTypes = {
  draftSaved: "draft-saved",
  submitted: "submitted",
  approved: "approved",
  agreed: "agreed",
  referenced: "referenced",
  rejected: "rejected",
  withdrawn: "withdrawn",
  resubmitted: "resubmitted",
} as const
export const grooApprovalResultValues = {
  approved: "approved",
  rejected: "rejected",
} as const

export const approvalDocumentExecutionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(approvalExecutionTypeValues.internal) }).strict(),
  z
    .object({
      type: z.literal(approvalExecutionTypeValues.groo),
      draftDocumentId: grooDocumentIdSchema,
      requestId: grooDocumentIdSchema,
    })
    .strict(),
])

export const accessPolicyEffectSchema = z.enum(accessPolicyEffects)
export const accessPolicyTypeSchema = z.enum(accessPolicyTypes)
export const accessPolicyManagementTypeSchema = z.enum(
  accessPolicyManagementTypes,
)
export const accessPolicyResourceTypeSchema = z.enum(accessPolicyResourceTypes)
export const accessPolicyAssignmentTargetSchema = z.enum(
  accessPolicyAssignmentTargets,
)

export const accessPolicyResourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(accessPolicyResourceTypes.endpoint),
    id: entityIdSchema,
  }),
  z.object({
    type: z.literal(accessPolicyResourceTypes.uiResource),
    id: entityIdSchema,
  }),
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
  approvalSteps: z
    .array(
      z.object({
        id: entityIdSchema,
        stage: z.number().int().min(1).max(12),
        kind: approvalStepKindSchema,
        assigneeType: z.enum(approvalAssigneeTypes),
        assigneeId: entityIdSchema,
      }),
    )
    .max(12)
    .superRefine((steps, context) => {
      if (steps.length === 0) return
      if (new Set(steps.map((step) => step.id)).size !== steps.length) {
        context.addIssue({ code: "custom", path: ["id"] })
      }
      if (
        steps[0]?.kind !== approvalStepKindValues.request ||
        steps[0].stage !== 1 ||
        steps
          .slice(1)
          .some((step) => step.kind === approvalStepKindValues.request)
      ) {
        context.addIssue({ code: "custom", path: ["kind"] })
      }
      if (
        !steps.some(
          (step) =>
            step.kind === approvalStepKindValues.approval ||
            step.kind === approvalStepKindValues.agreement,
        )
      ) {
        context.addIssue({ code: "custom", path: ["kind"] })
      }
      if (
        steps.some((step, index) => {
          const previous = steps[index - 1]
          return (
            index > 0 &&
            (!previous ||
              step.stage < previous.stage ||
              step.stage > previous.stage + 1)
          )
        })
      ) {
        context.addIssue({ code: "custom", path: ["stage"] })
      }
    }),
  submission: z.enum(approvalDocumentSubmissions),
})

const credentialEndpointIdsSchema = z
  .array(entityIdSchema)
  .max(100)
  .refine((values) => new Set(values).size === values.length)

const generalApprovalDocumentInputSchema = z.discriminatedUnion("type", [
  approvalDocumentBaseSchema.extend({
    documentKind: z.literal(approvalDocumentKinds.general),
    type: z.literal(accessPolicyTypes.accessGrant),
    accessPolicyId: entityIdSchema,
    expiresAt: z.iso.datetime(),
  }),
  approvalDocumentBaseSchema.extend({
    documentKind: z.literal(approvalDocumentKinds.general),
    type: z.enum([
      approvalTypeValues.resourceCreate,
      approvalTypeValues.accessRevoke,
      approvalTypeValues.resourceDispose,
    ]),
  }),
])

export const approvalDocumentInputSchema = z.union([
  generalApprovalDocumentInputSchema,
  approvalDocumentBaseSchema.extend({
    documentKind: z.literal(approvalDocumentKinds.apiKeyIssuance),
    type: z.literal(approvalTypeValues.apiKey),
    applicationId: entityIdSchema,
    serviceId: entityIdSchema,
    endpointIds: credentialEndpointIdsSchema,
    keyName: z.string().trim().min(2).max(80),
    awsSecretName: awsSecretNameSchema,
    awsSecretKey: awsSecretKeySchema,
  }),
  approvalDocumentBaseSchema.extend({
    documentKind: z.literal(approvalDocumentKinds.apiKeyLifecycle),
    type: z.literal(approvalTypeValues.apiKeyReplace),
    apiKeyId: entityIdSchema,
    awsSecretName: awsSecretNameSchema,
    awsSecretKey: awsSecretKeySchema,
  }),
  approvalDocumentBaseSchema.extend({
    documentKind: z.literal(approvalDocumentKinds.apiKeyLifecycle),
    type: z.literal(approvalTypeValues.apiKeyDispose),
    apiKeyId: entityIdSchema,
  }),
])

export type AccessPolicyEffect = z.infer<typeof accessPolicyEffectSchema>
export type AccessPolicyType = z.infer<typeof accessPolicyTypeSchema>
export type AccessPolicyManagementType = z.infer<
  typeof accessPolicyManagementTypeSchema
>
export type AccessPolicyResourceType = z.infer<
  typeof accessPolicyResourceTypeSchema
>
export type AccessPolicyAssignmentTarget = z.infer<
  typeof accessPolicyAssignmentTargetSchema
>
export type AccessPolicyInput = z.input<typeof accessPolicyInputSchema>
export type AccessPolicyValue = z.output<typeof accessPolicyInputSchema>
export type AccessPolicyResource = z.infer<typeof accessPolicyResourceSchema>
export type ApprovalDocumentInput = z.infer<typeof approvalDocumentInputSchema>

export const approvalDocumentActionInputSchema = z.object({
  documentId: entityIdSchema,
  actorUserId: entityIdSchema,
  stepId: entityIdSchema,
  decision: z.enum(approvalDecisions),
  comment: z.string().trim().max(1000),
})

export const approvalDocumentTransitionInputSchema = z.object({
  documentId: entityIdSchema,
  actorUserId: entityIdSchema,
})

export const grooApprovalCompletionInputSchema = z
  .object({
    requestId: grooDocumentIdSchema,
    result: z.enum(grooApprovalResultValues),
    completedAt: z.iso.datetime(),
  })
  .strict()

export type ApprovalDocumentActionInput = z.infer<
  typeof approvalDocumentActionInputSchema
>
export type ApprovalDocumentTransitionInput = z.infer<
  typeof approvalDocumentTransitionInputSchema
>
export type GrooApprovalCompletionInput = z.infer<
  typeof grooApprovalCompletionInputSchema
>

export type AccessPolicy = AccessPolicyValue & {
  id: string
  managementType: AccessPolicyManagementType
  status: EntityStatus
  createdAt: string
}
export type AccessPolicyAssignment = {
  id: string
  accessPolicyId: string
  targetType: AccessPolicyAssignmentTarget
  targetId: string
  expiresAt: string | null
  createdAt: string
}
export type ApprovalDocumentStatus =
  (typeof approvalDocumentStatuses)[keyof typeof approvalDocumentStatuses]
export type ApprovalDocumentSubmission =
  (typeof approvalDocumentSubmissions)[keyof typeof approvalDocumentSubmissions]
export type ApprovalAssigneeType =
  (typeof approvalAssigneeTypes)[keyof typeof approvalAssigneeTypes]
export type ApprovalStepStatus =
  (typeof approvalStepStatuses)[keyof typeof approvalStepStatuses]
export type ApprovalDocumentStep = ResolvedApprovalStep & {
  status: ApprovalStepStatus
  processedById: string | null
  processedAt: string | null
  comment: string | null
}
export type ApprovalDocumentHistoryEvent = {
  id: string
  type: (typeof approvalDocumentHistoryEventTypes)[keyof typeof approvalDocumentHistoryEventTypes]
  actorUserId: string | null
  stepId: string | null
  comment: string | null
  createdAt: string
}
type StoredApprovalDocumentInput<
  Input extends ApprovalDocumentInput = ApprovalDocumentInput,
> = Input extends ApprovalDocumentInput
  ? Omit<Input, "submission" | "approvalSteps">
  : never

export type ApprovalDocument = StoredApprovalDocumentInput & {
  id: string
  status: ApprovalDocumentStatus
  createdAt: string
  approvalExecution: z.infer<typeof approvalDocumentExecutionSchema>
  approvalSteps: ApprovalDocumentStep[]
  history: ApprovalDocumentHistoryEvent[]
}
export type ApprovalCompletion = { document: ApprovalDocument }

export function isCredentialApprovalType(type: ApprovalType) {
  return (
    type === approvalTypeValues.apiKey ||
    type === approvalTypeValues.apiKeyReplace ||
    type === approvalTypeValues.apiKeyDispose
  )
}
