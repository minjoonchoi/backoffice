import type { CommandResult, EntityStatus } from "@/domain/common"
import type {
  ApprovalLine,
  ApprovalLineInput,
} from "@/features/request-templates/model"

export interface RequestTemplateApi {
  createApprovalLine: (
    input: ApprovalLineInput,
  ) => Promise<CommandResult<ApprovalLine>>
  updateApprovalLine: (
    id: string,
    input: ApprovalLineInput,
  ) => Promise<CommandResult<ApprovalLine>>
  setApprovalLineStatus: (
    id: string,
    status: EntityStatus,
  ) => Promise<CommandResult<ApprovalLine>>
}

export interface RequestTemplateApiClient {
  createApprovalLine: (request: {
    body: ApprovalLineInput
  }) => Promise<CommandResult<ApprovalLine>>
  updateApprovalLine: (request: {
    id: string
    body: ApprovalLineInput
  }) => Promise<CommandResult<ApprovalLine>>
  setApprovalLineStatus: (request: {
    approvalLineId: string
    status: EntityStatus
  }) => Promise<CommandResult<ApprovalLine>>
}
