import { z } from "zod"

import { entityIdSchema, type EntityStatus } from "@/domain/common"

export const approvalTypeSchema = z.enum([
  "resource-create",
  "access-grant",
  "access-revoke",
  "resource-dispose",
  "api-key",
  "api-key-replace",
  "api-key-dispose",
])
export const requestCategorySchema = z.enum(["permission", "credential"])
export const approvalStepKindSchema = z.enum([
  "request",
  "approval",
  "agreement",
  "reference",
])
export const approvalAssigneeModeSchema = z.enum([
  "fixed-user",
  "fixed-organization",
  "document-select",
  "requester",
  "request-organization-leader",
  "request-organization",
  "service-owner-organization",
])
export const requestTemplateFieldBindingSchema = z.enum([
  "service-id",
  "request-organization-id",
  "key-name",
  "aws-secret-name",
  "aws-secret-key",
  "content",
  "custom",
])
export const requestTemplateFieldControlSchema = z.enum([
  "text",
  "textarea",
  "service-select",
  "organization-select",
])

const approvalStepInputBaseSchema = z.object({
  kind: approvalStepKindSchema,
  stage: z.number().int().min(1).max(12),
})
export const approvalStepInputSchema = z.discriminatedUnion("assigneeMode", [
  approvalStepInputBaseSchema.extend({
    assigneeMode: z.literal("fixed-user"),
    userId: entityIdSchema,
  }),
  approvalStepInputBaseSchema.extend({
    assigneeMode: z.literal("fixed-organization"),
    organizationId: entityIdSchema,
  }),
  approvalStepInputBaseSchema.extend({
    assigneeMode: z.literal("document-select"),
  }),
  approvalStepInputBaseSchema.extend({ assigneeMode: z.literal("requester") }),
  approvalStepInputBaseSchema.extend({
    assigneeMode: z.literal("request-organization-leader"),
  }),
  approvalStepInputBaseSchema.extend({
    assigneeMode: z.literal("request-organization"),
  }),
  approvalStepInputBaseSchema.extend({
    assigneeMode: z.literal("service-owner-organization"),
  }),
])

const approvalStepsInputSchema = z
  .array(approvalStepInputSchema)
  .min(1)
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
    binding: z.literal("service-id"),
    control: z.literal("service-select"),
  }),
  requestTemplateFieldBaseSchema.extend({
    binding: z.literal("request-organization-id"),
    control: z.literal("organization-select"),
  }),
  requestTemplateFieldBaseSchema.extend({
    binding: z.literal("key-name"),
    control: z.literal("text"),
  }),
  requestTemplateFieldBaseSchema.extend({
    binding: z.literal("aws-secret-name"),
    control: z.literal("text"),
  }),
  requestTemplateFieldBaseSchema.extend({
    binding: z.literal("aws-secret-key"),
    control: z.literal("text"),
  }),
  requestTemplateFieldBaseSchema.extend({
    binding: z.literal("content"),
    control: z.literal("textarea"),
  }),
  requestTemplateFieldBaseSchema.extend({
    binding: z.literal("custom"),
    control: z.enum(["text", "textarea"]),
  }),
])

export const approvalLineInputSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    category: requestCategorySchema,
    type: approvalTypeSchema,
    steps: approvalStepsInputSchema,
    fields: z.array(requestTemplateFieldInputSchema).max(30),
  })
  .refine(
    (template) =>
      template.category === "credential"
        ? ["api-key", "api-key-replace", "api-key-dispose"].includes(
            template.type,
          )
        : !template.type.startsWith("api-key"),
    { path: ["type"] },
  )
  .refine(
    (template) =>
      template.category === "credential" ||
      template.steps.every(
        (step) => step.assigneeMode !== "service-owner-organization",
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
        .filter((field) => field.binding !== "custom")
        .map((field) => field.binding)
      return new Set(systemBindings).size === systemBindings.length
    },
    { path: ["fields"] },
  )

export type ApprovalType = z.infer<typeof approvalTypeSchema>
export type RequestCategory = z.infer<typeof requestCategorySchema>
export type ApprovalStepKind = z.infer<typeof approvalStepKindSchema>
export type ApprovalAssigneeMode = z.infer<typeof approvalAssigneeModeSchema>
export type RequestTemplateFieldBinding = z.infer<
  typeof requestTemplateFieldBindingSchema
>
export type RequestTemplateFieldControl = z.infer<
  typeof requestTemplateFieldControlSchema
>

export const approvalTypes: ApprovalType[] = [
  "resource-create",
  "access-grant",
  "access-revoke",
  "resource-dispose",
  "api-key",
  "api-key-replace",
  "api-key-dispose",
]
export const requestCategories: RequestCategory[] = ["permission", "credential"]
export const approvalStepKinds: ApprovalStepKind[] = [
  "request",
  "approval",
  "agreement",
  "reference",
]
export const approvalAssigneeModes: ApprovalAssigneeMode[] = [
  "fixed-user",
  "fixed-organization",
  "document-select",
  "requester",
  "request-organization-leader",
  "request-organization",
  "service-owner-organization",
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
  status: EntityStatus
  createdAt: string
  steps: ApprovalStep[]
  fields: RequestTemplateField[]
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
