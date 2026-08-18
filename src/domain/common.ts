import { z } from "zod"

export const entityStatuses = {
  active: "active",
  inactive: "inactive",
} as const
export const entityStatusSchema = z.enum(entityStatuses)
export const entityIdSchema = z.uuid()
export const entityIdListSchema = z
  .array(entityIdSchema)
  .min(1)
  .max(100)
  .refine((values) => new Set(values).size === values.length)

export type EntityStatus = z.infer<typeof entityStatusSchema>

export const backofficeErrorCodes = {
  invalidInput: "invalid-input",
  organizationNotFound: "organization-not-found",
  userEmailExists: "user-email-exists",
  userNicknameExists: "user-nickname-exists",
  userNotFound: "user-not-found",
  roleNameExists: "role-name-exists",
  roleNotFound: "role-not-found",
  roleInUse: "role-in-use",
  policyNameExists: "policy-name-exists",
  policyOperationForbidden: "policy-operation-forbidden",
  policyNotFound: "policy-not-found",
  policyAssignmentNotFound: "policy-assignment-not-found",
  policyAssignmentForbidden: "policy-assignment-forbidden",
  accessPolicyAlreadyAssigned: "access-policy-already-assigned",
  protectedRelationship: "protected-relationship",
  approvalLineNotFound: "approval-line-not-found",
  approvalLineAmbiguous: "approval-line-ambiguous",
  approvalReferenceMismatch: "approval-reference-mismatch",
  requestOrganizationLeaderUnavailable:
    "request-organization-leader-unavailable",
  approvalDocumentNotFound: "approval-document-not-found",
  approvalDocumentAlreadyExists: "approval-document-already-exists",
  notificationNotFound: "notification-not-found",
  notificationOperationForbidden: "notification-operation-forbidden",
  approvalDocumentNotSubmitted: "approval-document-not-submitted",
  approvalDocumentActionForbidden: "approval-document-action-forbidden",
  approvalDocumentStepNotActionable: "approval-document-step-not-actionable",
  approvalDocumentTransitionInvalid: "approval-document-transition-invalid",
  approvalDocumentNotApproved: "approval-document-not-approved",
  apiKeyRequestInvalid: "api-key-request-invalid",
  credentialAlreadyOwned: "credential-already-owned",
  apiKeyAlreadyRegistered: "api-key-already-registered",
  apiKeyRegistrationForbidden: "api-key-registration-forbidden",
  internalCredentialRegistrationFailed:
    "internal-credential-registration-failed",
  serviceKeyExists: "service-key-exists",
  serviceNotFound: "service-not-found",
  endpointServiceInvalid: "endpoint-service-invalid",
  endpointExists: "endpoint-exists",
  endpointNotFound: "endpoint-not-found",
  endpointSyncForbidden: "endpoint-sync-forbidden",
  uiResourceImportForbidden: "ui-resource-import-forbidden",
  uiResourceDeleteForbidden: "ui-resource-delete-forbidden",
  uiResourceStatusForbidden: "ui-resource-status-forbidden",
  namespaceOperationForbidden: "namespace-operation-forbidden",
  namespaceKeyExists: "namespace-key-exists",
  namespaceNameExists: "namespace-name-exists",
  namespaceNotFound: "namespace-not-found",
  uiResourceNotFound: "ui-resource-not-found",
  uiResourceNamespaceMismatch: "ui-resource-namespace-mismatch",
  uiResourceParentNotFound: "ui-resource-parent-not-found",
} as const

export const apiResponseErrorCodes = {
  invalidJson: "invalid-json",
  invalidInput: backofficeErrorCodes.invalidInput,
} as const

export type BackofficeErrorCode =
  (typeof backofficeErrorCodes)[keyof typeof backofficeErrorCodes]

export type CommandResult<Entity> =
  { ok: true; value: Entity } | { ok: false; error: BackofficeErrorCode }
