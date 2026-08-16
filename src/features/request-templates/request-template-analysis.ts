import { requestCategoryValues } from "@/features/request-templates/model"
import type { BackofficeState } from "@/application/state/model"
import type { ApprovalLine } from "@/features/request-templates/model"
import { createRequestApprovalLineDraft } from "@/features/request-templates/request-approval-line"
import { isAccessPolicyEffective } from "@/features/access-policies/access-policy-status"

type RequestTemplateAnalysisState = Pick<
  BackofficeState,
  | "accessPolicies"
  | "approvalDocuments"
  | "organizations"
  | "services"
  | "users"
>

export type RequestTemplateImpact = Readonly<{
  serviceIds: readonly string[]
  policyIds: readonly string[]
  inFlightRequestIds: readonly string[]
}>

export function resolveRequestTemplateImpact(
  state: RequestTemplateAnalysisState,
  template: ApprovalLine,
): RequestTemplateImpact {
  const serviceIds = state.services
    .filter((service) =>
      Object.values(service.credentialTemplateIds).includes(template.id),
    )
    .map((service) => service.id)
  return {
    serviceIds,
    policyIds: state.accessPolicies
      .filter(
        (policy) =>
          isAccessPolicyEffective(policy) &&
          template.category === requestCategoryValues.permission &&
          template.type === policy.type,
      )
      .map((policy) => policy.id),
    inFlightRequestIds: state.approvalDocuments
      .filter(
        (document) =>
          document.approvalLineId === template.id &&
          ["draft", "submitted"].includes(document.status),
      )
      .map((document) => document.id),
  }
}

export function previewRequestTemplate(
  state: RequestTemplateAnalysisState,
  template: ApprovalLine,
  input: {
    requesterId: string
    requestOrganizationId: string
    serviceId: string | null
  },
) {
  const service = input.serviceId
    ? state.services.find((candidate) => candidate.id === input.serviceId)
    : undefined
  return createRequestApprovalLineDraft(state, template, {
    requesterId: input.requesterId,
    requestOrganizationId: input.requestOrganizationId,
    serviceOwnerOrganizationId: service?.ownerOrganizationId,
  })
}
