import { z } from "zod"

import { entityIdSchema, type EntityStatus } from "@/domain/common"

export const approvalTypeValues = {
  resourceCreate: "resource-create",
  accessGrant: "access-grant",
  accessRevoke: "access-revoke",
  resourceDispose: "resource-dispose",
  apiKey: "api-key",
  apiKeyReplace: "api-key-replace",
  apiKeyDispose: "api-key-dispose",
} as const
export const requestCategoryValues = {
  permission: "permission",
  credential: "credential",
} as const
export const approvalExecutionTypeValues = {
  internal: "internal",
  groo: "groo",
} as const
export const approvalStepKindValues = {
  request: "request",
  approval: "approval",
  agreement: "agreement",
  reference: "reference",
} as const
export const approvalAssigneeModeValues = {
  fixedUser: "fixed-user",
  fixedOrganization: "fixed-organization",
  documentSelect: "document-select",
  requester: "requester",
  requestOrganizationLeader: "request-organization-leader",
  requestOrganization: "request-organization",
  serviceOwnerOrganization: "service-owner-organization",
} as const
export const requestTemplateFieldBindingValues = {
  serviceId: "service-id",
  requestOrganizationId: "request-organization-id",
  keyName: "key-name",
  awsSecretName: "aws-secret-name",
  awsSecretKey: "aws-secret-key",
  content: "content",
  custom: "custom",
} as const
export const requestTemplateFieldControlValues = {
  text: "text",
  textarea: "textarea",
  serviceSelect: "service-select",
  organizationSelect: "organization-select",
} as const

export const approvalTypeSchema = z.enum(approvalTypeValues)
export const requestCategorySchema = z.enum(requestCategoryValues)
export const approvalExecutionTypeSchema = z.enum(approvalExecutionTypeValues)
export const grooDocumentIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^\S+$/)
export const approvalExecutionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(approvalExecutionTypeValues.internal) }).strict(),
  z
    .object({
      type: z.literal(approvalExecutionTypeValues.groo),
      draftDocumentId: grooDocumentIdSchema,
    })
    .strict(),
])
export const approvalStepKindSchema = z.enum(approvalStepKindValues)
export const approvalAssigneeModeSchema = z.enum(approvalAssigneeModeValues)
export const requestTemplateFieldBindingSchema = z.enum(
  requestTemplateFieldBindingValues,
)
export const requestTemplateFieldControlSchema = z.enum(
  requestTemplateFieldControlValues,
)
const credentialApprovalTypes = new Set<z.infer<typeof approvalTypeSchema>>([
  approvalTypeValues.apiKey,
  approvalTypeValues.apiKeyReplace,
  approvalTypeValues.apiKeyDispose,
])

const approvalStepInputBaseSchema = z.object({
  kind: approvalStepKindSchema,
  stage: z.number().int().min(1).max(12),
})
export const approvalStepInputSchema = z.discriminatedUnion("assigneeMode", [
  approvalStepInputBaseSchema.extend({
    assigneeMode: z.literal(approvalAssigneeModeValues.fixedUser),
    userId: entityIdSchema,
  }),
  approvalStepInputBaseSchema.extend({
    assigneeMode: z.literal(approvalAssigneeModeValues.fixedOrganization),
    organizationId: entityIdSchema,
  }),
  approvalStepInputBaseSchema.extend({
    assigneeMode: z.literal(approvalAssigneeModeValues.documentSelect),
  }),
  approvalStepInputBaseSchema.extend({
    assigneeMode: z.literal(approvalAssigneeModeValues.requester),
  }),
  approvalStepInputBaseSchema.extend({
    assigneeMode: z.literal(
      approvalAssigneeModeValues.requestOrganizationLeader,
    ),
  }),
  approvalStepInputBaseSchema.extend({
    assigneeMode: z.literal(approvalAssigneeModeValues.requestOrganization),
  }),
  approvalStepInputBaseSchema.extend({
    assigneeMode: z.literal(
      approvalAssigneeModeValues.serviceOwnerOrganization,
    ),
  }),
])

const approvalStepsInputSchema = z
  .array(approvalStepInputSchema)
  .max(12)
  .refine(
    (steps) =>
      steps.every((step, index) => {
        const previous = steps[index - 1]
        return index === 0
          ? step.stage === 1
          : Boolean(
              previous &&
              step.stage >= previous.stage &&
              step.stage <= previous.stage + 1,
            )
      }),
    { path: ["stage"] },
  )

const requestTemplateFieldBaseSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z]+(?:-[a-z]+)*$/),
  label: z.string().trim().min(1).max(80),
  required: z.boolean(),
})
export const requestTemplateFieldInputSchema = z.discriminatedUnion("binding", [
  requestTemplateFieldBaseSchema.extend({
    binding: z.literal(requestTemplateFieldBindingValues.serviceId),
    control: z.literal(requestTemplateFieldControlValues.serviceSelect),
  }),
  requestTemplateFieldBaseSchema.extend({
    binding: z.literal(requestTemplateFieldBindingValues.requestOrganizationId),
    control: z.literal(requestTemplateFieldControlValues.organizationSelect),
  }),
  requestTemplateFieldBaseSchema.extend({
    binding: z.literal(requestTemplateFieldBindingValues.keyName),
    control: z.literal(requestTemplateFieldControlValues.text),
  }),
  requestTemplateFieldBaseSchema.extend({
    binding: z.literal(requestTemplateFieldBindingValues.awsSecretName),
    control: z.literal(requestTemplateFieldControlValues.text),
  }),
  requestTemplateFieldBaseSchema.extend({
    binding: z.literal(requestTemplateFieldBindingValues.awsSecretKey),
    control: z.literal(requestTemplateFieldControlValues.text),
  }),
  requestTemplateFieldBaseSchema.extend({
    binding: z.literal(requestTemplateFieldBindingValues.content),
    control: z.literal(requestTemplateFieldControlValues.textarea),
  }),
  requestTemplateFieldBaseSchema.extend({
    binding: z.literal(requestTemplateFieldBindingValues.custom),
    control: z.enum([
      requestTemplateFieldControlValues.text,
      requestTemplateFieldControlValues.textarea,
    ]),
  }),
])

export const approvalLineInputSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    category: requestCategorySchema,
    type: approvalTypeSchema,
    approvalExecution: approvalExecutionSchema,
    steps: approvalStepsInputSchema,
    fields: z.array(requestTemplateFieldInputSchema).max(30),
  })
  .refine(
    (template) =>
      template.approvalExecution.type === approvalExecutionTypeValues.groo
        ? template.steps.length === 0
        : template.steps.length > 0,
    { path: ["steps"] },
  )
  .refine(
    (template) =>
      template.category === requestCategoryValues.credential
        ? credentialApprovalTypes.has(template.type)
        : !template.type.startsWith("api-key"),
    { path: ["type"] },
  )
  .refine(
    (template) =>
      template.category === requestCategoryValues.credential ||
      template.steps.every(
        (step) =>
          step.assigneeMode !==
          approvalAssigneeModeValues.serviceOwnerOrganization,
      ),
    { path: ["steps"] },
  )
  .refine(
    (template) =>
      new Set(template.fields.map((field) => field.key)).size ===
      template.fields.length,
    { path: ["fields"] },
  )
  .refine(
    (template) => {
      const systemBindings = template.fields
        .filter(
          (field) => field.binding !== requestTemplateFieldBindingValues.custom,
        )
        .map((field) => field.binding)
      return new Set(systemBindings).size === systemBindings.length
    },
    { path: ["fields"] },
  )

export type ApprovalType = z.infer<typeof approvalTypeSchema>
export type RequestCategory = z.infer<typeof requestCategorySchema>
export type ApprovalExecutionType = z.infer<typeof approvalExecutionTypeSchema>
export type ApprovalExecution = z.infer<typeof approvalExecutionSchema>
export type ApprovalStepKind = z.infer<typeof approvalStepKindSchema>
export type ApprovalAssigneeMode = z.infer<typeof approvalAssigneeModeSchema>
export type RequestTemplateFieldBinding = z.infer<
  typeof requestTemplateFieldBindingSchema
>
export type RequestTemplateFieldControl = z.infer<
  typeof requestTemplateFieldControlSchema
>

export const approvalTypes: ApprovalType[] = [
  ...Object.values(approvalTypeValues),
]
export const requestCategories: RequestCategory[] = Object.values(
  requestCategoryValues,
)
export const approvalStepKinds: ApprovalStepKind[] = [
  ...Object.values(approvalStepKindValues),
]
export const approvalAssigneeModes: ApprovalAssigneeMode[] = [
  ...Object.values(approvalAssigneeModeValues),
]

export type ApprovalLineInput = z.infer<typeof approvalLineInputSchema>
export type RequestTemplateFieldInput = z.infer<
  typeof requestTemplateFieldInputSchema
>
export type ApprovalStep = ApprovalLineInput["steps"][number] & {
  id: string
  order: number
}
export type RequestTemplateField = RequestTemplateFieldInput & {
  id: string
  order: number
}
export type ApprovalLine = Omit<ApprovalLineInput, "steps" | "fields"> & {
  id: string
  version: number
  status: EntityStatus
  createdAt: string
  steps: ApprovalStep[]
  fields: RequestTemplateField[]
}

export type ApprovalLineRevision = {
  id: string
  approvalLineId: string
  version: number
  snapshot: ApprovalLine
  createdAt: string
}

type ResolvedApprovalStepBase = {
  id: string
  order: number
  stage: number
  kind: ApprovalStepKind
  assigneeMode: ApprovalAssigneeMode
}
export type ResolvedApprovalStep = ResolvedApprovalStepBase &
  (
    | { assigneeType: "user"; assigneeId: string }
    | { assigneeType: "organization"; assigneeId: string }
  )
