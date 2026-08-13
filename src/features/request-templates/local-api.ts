import type { RequestTemplateApi } from "@/features/request-templates/api"
import { entityStatusSchema } from "@/domain/common"
import type { BackofficeStateUpdater } from "@/application/api/local-state"
import type { BackofficeState } from "@/application/state/model"
import {
  approvalLineInputSchema,
  type ApprovalLine,
  type ApprovalLineInput,
} from "@/features/request-templates/model"

function referencesMatch(
  input: ApprovalLineInput,
  state: Pick<BackofficeState, "organizations" | "users">,
) {
  return input.steps.every((step) => {
    if (step.assigneeMode === "fixed-user") {
      return state.users.some(
        (user) =>
          user.id === step.userId && user.employmentStatus === "employed",
      )
    }
    if (step.assigneeMode === "fixed-organization") {
      return state.organizations.some(
        (organization) => organization.id === step.organizationId,
      )
    }
    return true
  })
}

function hasRequiredCredentialBindings(
  input: Pick<ApprovalLineInput, "type" | "fields">,
) {
  const requiredBindings =
    input.type === "api-key"
      ? [
          "service-id",
          "request-organization-id",
          "key-name",
          "aws-secret-name",
          "aws-secret-key",
          "content",
        ]
      : input.type === "api-key-replace"
        ? [
            "request-organization-id",
            "aws-secret-name",
            "aws-secret-key",
            "content",
          ]
        : input.type === "api-key-dispose"
          ? ["request-organization-id", "content"]
          : []
  return requiredBindings.every((binding) =>
    input.fields.some((field) => field.binding === binding && field.required),
  )
}

export function createLocalRequestTemplateApi(
  state: BackofficeState,
  updateState: BackofficeStateUpdater,
): RequestTemplateApi {
  return {
    createApprovalLine: async (input) => {
      await Promise.resolve()
      const parsed = approvalLineInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (!hasRequiredCredentialBindings(parsed.data)) {
        return { ok: false, error: "invalid-input" }
      }
      if (!referencesMatch(parsed.data, state)) {
        return { ok: false, error: "approval-reference-mismatch" }
      }
      const approvalLine: ApprovalLine = {
        id: crypto.randomUUID(),
        name: parsed.data.name,
        category: parsed.data.category,
        type: parsed.data.type,
        status: "active",
        createdAt: new Date().toISOString(),
        steps: parsed.data.steps.map((step, index) => ({
          ...step,
          id: crypto.randomUUID(),
          order: index + 1,
        })),
        fields: parsed.data.fields.map((field, index) => ({
          ...field,
          id: crypto.randomUUID(),
          order: index + 1,
        })),
      }
      updateState((current) => ({
        ...current,
        approvalLines: [...current.approvalLines, approvalLine],
      }))
      return { ok: true, value: approvalLine }
    },

    updateApprovalLine: async (id, input) => {
      await Promise.resolve()
      const parsed = approvalLineInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      const existing = state.approvalLines.find((item) => item.id === id)
      if (!existing) return { ok: false, error: "approval-line-not-found" }
      if (!hasRequiredCredentialBindings(parsed.data)) {
        return { ok: false, error: "invalid-input" }
      }
      if (!referencesMatch(parsed.data, state)) {
        return { ok: false, error: "approval-reference-mismatch" }
      }
      const updated: ApprovalLine = {
        ...existing,
        name: parsed.data.name,
        category: parsed.data.category,
        type: parsed.data.type,
        steps: parsed.data.steps.map((step, index) => ({
          ...step,
          id: existing.steps[index]?.id ?? crypto.randomUUID(),
          order: index + 1,
        })),
        fields: parsed.data.fields.map((field, index) => ({
          ...field,
          id:
            existing.fields.find((item) => item.key === field.key)?.id ??
            crypto.randomUUID(),
          order: index + 1,
        })),
      }
      updateState((current) => ({
        ...current,
        approvalLines: current.approvalLines.map((item) =>
          item.id === id ? updated : item,
        ),
      }))
      return { ok: true, value: updated }
    },

    setApprovalLineStatus: async (id, status) => {
      await Promise.resolve()
      if (!entityStatusSchema.safeParse(status).success) {
        return { ok: false, error: "invalid-input" }
      }
      const line = state.approvalLines.find((candidate) => candidate.id === id)
      if (!line) return { ok: false, error: "approval-line-not-found" }
      const updated = { ...line, status }
      updateState((current) => ({
        ...current,
        approvalLines: current.approvalLines.map((line) =>
          line.id === id ? updated : line,
        ),
      }))
      return { ok: true, value: updated }
    },
  }
}
