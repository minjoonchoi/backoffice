import type { CommandResult, EntityStatus } from "@/domain/common"
import type {
  ApprovalLine,
  ApprovalLineInput,
} from "@/features/request-templates/model"

export interface RequestTemplateApi {
  createApprovalLine: (
    input: ApprovalLineInput,
    requesterId?: string,
  ) => Promise<CommandResult<ApprovalLine>>
  cloneApprovalLine: (
    sourceApprovalLineId: string,
    name: string,
    requesterId?: string,
  ) => Promise<CommandResult<ApprovalLine>>
  updateApprovalLine: (
    id: string,
    input: ApprovalLineInput,
    requesterId?: string,
  ) => Promise<CommandResult<ApprovalLine>>
  setApprovalLineStatus: (
    id: string,
    status: EntityStatus,
    requesterId?: string,
  ) => Promise<CommandResult<ApprovalLine>>
}

export interface RequestTemplateApiClient {
  createApprovalLine: (request: {
    body: ApprovalLineInput
    requesterId: string
  }) => Promise<CommandResult<ApprovalLine>>
  cloneApprovalLine: (request: {
    sourceApprovalLineId: string
    name: string
    requesterId: string
  }) => Promise<CommandResult<ApprovalLine>>
  updateApprovalLine: (request: {
    id: string
    body: ApprovalLineInput
    requesterId: string
  }) => Promise<CommandResult<ApprovalLine>>
  setApprovalLineStatus: (request: {
    approvalLineId: string
    status: EntityStatus
    requesterId: string
  }) => Promise<CommandResult<ApprovalLine>>
}
