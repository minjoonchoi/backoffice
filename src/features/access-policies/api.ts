import type {
  AccessPolicy,
  AccessPolicyInput,
  AccessPolicyAssignment,
  AccessPolicyAssignmentTarget,
  ApprovalCompletion,
  ApprovalDocument,
  ApprovalDocumentInput,
} from "@/features/access-policies/model"
import type { CommandResult } from "@/domain/common"

export interface AccessPolicyApi {
  assignAccessPoliciesToTarget: (
    accessPolicyIds: string[],
    targetType: AccessPolicyAssignmentTarget,
    targetId: string,
    requesterId: string,
  ) => Promise<CommandResult<AccessPolicyAssignment[]>>
  unassignAccessPolicyFromTarget: (
    assignmentId: string,
    requesterId: string,
  ) => Promise<CommandResult<AccessPolicyAssignment>>
  createAccessPolicy: (
    input: AccessPolicyInput,
    requesterId: string,
  ) => Promise<CommandResult<AccessPolicy>>
  updateAccessPolicy: (
    id: string,
    input: AccessPolicyInput,
    requesterId: string,
  ) => Promise<CommandResult<AccessPolicy>>
  deleteAccessPolicy: (
    id: string,
    requesterId: string,
  ) => Promise<CommandResult<AccessPolicy>>
}

export interface ApprovalDocumentApi {
  createApprovalDocument: (
    input: ApprovalDocumentInput,
  ) => Promise<CommandResult<ApprovalDocument>>
  approveApprovalDocument: (
    id: string,
  ) => Promise<CommandResult<ApprovalCompletion>>
}

export interface AccessPolicyApiClient {
  assignAccessPoliciesToTarget: (request: {
    accessPolicyIds: string[]
    targetType: AccessPolicyAssignmentTarget
    targetId: string
    requesterId: string
  }) => Promise<CommandResult<AccessPolicyAssignment[]>>
  unassignAccessPolicyFromTarget: (request: {
    assignmentId: string
    requesterId: string
  }) => Promise<CommandResult<AccessPolicyAssignment>>
  createAccessPolicy: (request: {
    body: AccessPolicyInput
    requesterId: string
  }) => Promise<CommandResult<AccessPolicy>>
  updateAccessPolicy: (request: {
    accessPolicyId: string
    body: AccessPolicyInput
    requesterId: string
  }) => Promise<CommandResult<AccessPolicy>>
  deleteAccessPolicy: (request: {
    accessPolicyId: string
    requesterId: string
  }) => Promise<CommandResult<AccessPolicy>>
}

export interface ApprovalDocumentApiClient {
  createApprovalDocument: (request: {
    body: ApprovalDocumentInput
  }) => Promise<CommandResult<ApprovalDocument>>
  approveApprovalDocument: (request: {
    approvalDocumentId: string
  }) => Promise<CommandResult<ApprovalCompletion>>
}
