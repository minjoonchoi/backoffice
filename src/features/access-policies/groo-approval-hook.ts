import type { CommandResult } from "@/domain/common"
import {
  approvalDocumentHistoryEventTypes,
  approvalDocumentStatuses,
  grooApprovalCompletionInputSchema,
  grooApprovalResultValues,
  type ApprovalDocument,
  type GrooApprovalCompletionInput,
} from "@/features/access-policies/model"
import { approvalExecutionTypeValues } from "@/features/request-templates/model"

export type GrooApprovalCompletion = Readonly<{
  document: ApprovalDocument
  changed: boolean
}>

export function completeGrooApprovalDocument(
  document: ApprovalDocument,
  input: GrooApprovalCompletionInput,
): CommandResult<GrooApprovalCompletion> {
  const parsed = grooApprovalCompletionInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid-input" }
  if (
    document.approvalExecution.type !== approvalExecutionTypeValues.groo ||
    document.approvalExecution.requestId !== parsed.data.requestId
  ) {
    return { ok: false, error: "approval-document-not-found" }
  }

  const nextStatus =
    parsed.data.result === grooApprovalResultValues.approved
      ? approvalDocumentStatuses.approved
      : approvalDocumentStatuses.rejected
  if (document.status === nextStatus) {
    return { ok: true, value: { document, changed: false } }
  }
  if (document.status !== approvalDocumentStatuses.submitted) {
    return { ok: false, error: "approval-document-transition-invalid" }
  }

  return {
    ok: true,
    value: {
      changed: true,
      document: {
        ...document,
        status: nextStatus,
        history: [
          ...document.history,
          {
            id: crypto.randomUUID(),
            type:
              nextStatus === approvalDocumentStatuses.approved
                ? approvalDocumentHistoryEventTypes.approved
                : approvalDocumentHistoryEventTypes.rejected,
            actorUserId: null,
            stepId: null,
            comment: null,
            createdAt: parsed.data.completedAt,
          },
        ],
      },
    },
  }
}
