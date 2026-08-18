import type {
  AccessPolicy,
  AccessPolicyInput,
  AccessPolicyAssignment,
  AccessPolicyAssignmentTarget,
  ApprovalCompletion,
  ApprovalDocumentActionInput,
  ApprovalDocument,
  ApprovalDocumentInput,
  ApprovalDocumentTransitionInput,
} from "@/features/access-policies/model"
import type { CommandResult } from "@/domain/common"
import type { AccessPolicyUpdateImpact } from "@/features/access-policies/access-policy-assignment"

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
  analyzeAccessPolicyUpdate: (
    id: string,
    input: AccessPolicyInput,
    requesterId: string,
  ) => Promise<CommandResult<AccessPolicyUpdateImpact>>
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
  processApprovalDocument: (
    input: ApprovalDocumentActionInput,
  ) => Promise<CommandResult<ApprovalCompletion>>
  withdrawApprovalDocument: (
    input: ApprovalDocumentTransitionInput,
  ) => Promise<CommandResult<ApprovalDocument>>
  resubmitApprovalDocument: (
    input: ApprovalDocumentTransitionInput,
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
  analyzeAccessPolicyUpdate: (request: {
    accessPolicyId: string
    body: AccessPolicyInput
    requesterId: string
  }) => Promise<CommandResult<AccessPolicyUpdateImpact>>
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
  processApprovalDocument: (request: {
    body: ApprovalDocumentActionInput
  }) => Promise<CommandResult<ApprovalCompletion>>
  withdrawApprovalDocument: (request: {
    body: ApprovalDocumentTransitionInput
  }) => Promise<CommandResult<ApprovalDocument>>
  resubmitApprovalDocument: (request: {
    body: ApprovalDocumentTransitionInput
  }) => Promise<CommandResult<ApprovalCompletion>>
}
