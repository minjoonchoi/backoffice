import {
  approvalAssigneeModeValues,
  approvalStepKindValues,
} from "@/features/request-templates/model"
import { approvalAssigneeTypes } from "@/features/access-policies/model"
import type { BackofficeState } from "@/application/state/model"
import type { ApprovalDocumentInput } from "@/features/access-policies/model"
import { resolveRequestOrganizationLeader } from "@/features/request-templates/approval-assignee"
import type {
  ApprovalLine,
  ApprovalStepKind,
} from "@/features/request-templates/model"

type RequestApprovalLineState = Pick<BackofficeState, "organizations" | "users">

export type RequestApprovalStepDraft = {
  id: string
  kind: ApprovalStepKind
  assigneeType: (typeof approvalAssigneeTypes)[keyof typeof approvalAssigneeTypes]
  assigneeId: string | null
  parallelWithPrevious: boolean
}

export type RequestApprovalStepInput =
  ApprovalDocumentInput["approvalSteps"][number]

export function createRequestApprovalLineDraft(
  state: RequestApprovalLineState,
  template: ApprovalLine,
  context: {
    requesterId: string | null | undefined
    requestOrganizationId: string | null | undefined
    serviceOwnerOrganizationId?: string | null | undefined
  },
): RequestApprovalStepDraft[] {
  const requestOrganizationLeader = resolveRequestOrganizationLeader(
    state,
    context.requestOrganizationId,
    context.requesterId,
  )

  return template.steps.map((step, index) => {
    let assigneeType: RequestApprovalStepDraft["assigneeType"] =
      approvalAssigneeTypes.user
    let assigneeId: string | null = null

    switch (step.assigneeMode) {
      case approvalAssigneeModeValues.fixedUser:
        assigneeId = step.userId
        break
      case approvalAssigneeModeValues.fixedOrganization:
        assigneeType = approvalAssigneeTypes.organization
        assigneeId = step.organizationId
        break
      case approvalAssigneeModeValues.documentSelect:
        break
      case approvalAssigneeModeValues.requester:
        assigneeId = context.requesterId ?? null
        break
      case approvalAssigneeModeValues.requestOrganizationLeader:
        assigneeId = requestOrganizationLeader?.leader.id ?? null
        break
      case approvalAssigneeModeValues.requestOrganization:
        assigneeType = approvalAssigneeTypes.organization
        assigneeId = context.requestOrganizationId ?? null
        break
      case approvalAssigneeModeValues.serviceOwnerOrganization:
        assigneeType = approvalAssigneeTypes.organization
        assigneeId = context.serviceOwnerOrganizationId ?? null
        break
    }

    return {
      id: step.id,
      kind: step.kind,
      assigneeType,
      assigneeId,
      parallelWithPrevious:
        index > 0 && step.stage === template.steps[index - 1]?.stage,
    }
  })
}

export function requestApprovalLineDraftIsComplete(
  steps: readonly RequestApprovalStepDraft[],
  requesterId: string | null | undefined,
) {
  return (
    steps.length >= 2 &&
    steps.length <= 12 &&
    steps[0]?.kind === approvalStepKindValues.request &&
    steps[0].assigneeType === approvalAssigneeTypes.user &&
    steps[0].assigneeId === requesterId &&
    steps.slice(1).every((step) => Boolean(step.assigneeId)) &&
    steps.some(
      (step) =>
        step.kind === approvalStepKindValues.approval ||
        step.kind === approvalStepKindValues.agreement,
    )
  )
}

export function toRequestApprovalStepInputs(
  steps: readonly RequestApprovalStepDraft[],
): RequestApprovalStepInput[] {
  let stage = 1
  return steps.map((step, index) => {
    if (index > 0 && !step.parallelWithPrevious) stage += 1
    return {
      id: step.id,
      stage,
      kind: step.kind,
      assigneeType: step.assigneeType,
      assigneeId: step.assigneeId ?? "",
    }
  })
}
