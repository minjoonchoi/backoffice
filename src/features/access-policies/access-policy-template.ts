import type { BackofficeState } from "@/application/state/model"
import type { AccessPolicyType } from "@/features/access-policies/model"
import type { ApprovalLine } from "@/features/request-templates/model"

type AccessPolicyTemplateState = Pick<BackofficeState, "approvalLines">

export function accessPolicyApprovalLines(
  state: AccessPolicyTemplateState,
  type: AccessPolicyType,
): ApprovalLine[] {
  return state.approvalLines.filter(
    (line) =>
      line.status === "active" &&
      line.category === "permission" &&
      line.type === type,
  )
}

export function resolveAccessPolicyApprovalLine(
  state: AccessPolicyTemplateState,
  type: AccessPolicyType,
): ApprovalLine {
  const lines = accessPolicyApprovalLines(state, type)
  if (lines.length !== 1) {
    throw new Error(
      `Access policy type requires exactly one active request template: ${type}`,
    )
  }
  const [line] = lines
  if (!line) {
    throw new Error(`Access policy request template not found: ${type}`)
  }
  return line
}
