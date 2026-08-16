import type {
  AccessPolicy,
  AccessPolicyAssignment,
  ApprovalDocument,
} from "@/features/access-policies/model"
import type {
  ApiKey,
  CredentialLifecycleSettings,
} from "@/features/credentials/model"
import type {
  Application,
  BackofficeUser,
  Organization,
  Role,
} from "@/features/iam/model"
import type {
  ApprovalLine,
  ApprovalLineRevision,
} from "@/features/request-templates/model"
import type {
  ManagedService,
  ServiceEndpoint,
  ServiceEndpointField,
  ServiceEndpointRevision,
} from "@/features/service-catalog/model"
import type {
  Namespace,
  UiResource,
  UiResourceSyncHistory,
} from "@/features/ui-resources/model"
import type { BackofficeSystemReferences } from "@/domain/system-references"
import type { AuditEvent } from "@/features/audit/model"
import { z } from "zod"

export const userNotificationEventValues = {
  requestSubmitted: "request-submitted",
  requestRejected: "request-rejected",
  requestWithdrawn: "request-withdrawn",
  resourceCreated: "resource-created",
  accessGranted: "access-granted",
  accessRevoked: "access-revoked",
  resourceDisposed: "resource-disposed",
  apiKeyIssued: "api-key-issued",
  apiKeyReplacementApproved: "api-key-replacement-approved",
  apiKeyDisposalApproved: "api-key-disposal-approved",
  apiKeyEmergencyRevoked: "api-key-emergency-revoked",
  accessPolicyUpdated: "access-policy-updated",
  serviceEndpointsSynchronized: "service-endpoints-synchronized",
} as const
export const userNotificationTargetTypeValues = {
  approvalDocument: "approval-document",
  accessPolicy: "access-policy",
  service: "service",
} as const
export const userNotificationEventSchema = z.enum(userNotificationEventValues)
export type UserNotificationEvent = z.infer<typeof userNotificationEventSchema>
export const userNotificationTargetTypeSchema = z.enum(
  userNotificationTargetTypeValues,
)
export type UserNotificationTargetType = z.infer<
  typeof userNotificationTargetTypeSchema
>
export type UserNotification = {
  id: string
  userId: string
  event: UserNotificationEvent
  targetType: UserNotificationTargetType
  targetId: string
  createdAt: string
  readAt: string | null
}
export type BackofficeState = {
  systemReferences: BackofficeSystemReferences
  organizations: Organization[]
  applications: Application[]
  users: BackofficeUser[]
  roles: Role[]
  approvalLines: ApprovalLine[]
  approvalLineRevisions: ApprovalLineRevision[]
  accessPolicies: AccessPolicy[]
  accessPolicyAssignments: AccessPolicyAssignment[]
  approvalDocuments: ApprovalDocument[]
  notifications: UserNotification[]
  services: ManagedService[]
  serviceEndpoints: ServiceEndpoint[]
  serviceEndpointFields: ServiceEndpointField[]
  serviceEndpointRevisions: ServiceEndpointRevision[]
  credentialLifecycleSettings: CredentialLifecycleSettings
  apiKeys: ApiKey[]
  namespaces: Namespace[]
  uiResources: UiResource[]
  uiResourceSyncHistories: UiResourceSyncHistory[]
  auditEvents: AuditEvent[]
}
