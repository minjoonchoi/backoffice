import type {
  AccessPolicy,
  AccessPolicyAssignment,
  ApprovalDocument,
} from "@/features/access-policies/model"
import type { ApiKey } from "@/features/credentials/model"
import type {
  BackofficeUser,
  Group,
  Organization,
  Role,
} from "@/features/iam/model"
import type { ApprovalLine } from "@/features/request-templates/model"
import type {
  ManagedService,
  ServiceEndpoint,
  ServiceEndpointField,
} from "@/features/service-catalog/model"
import type { UiNamespace, UiResource } from "@/features/ui-resources/model"
import type { BackofficeSystemReferences } from "@/domain/system-references"
import { z } from "zod"

export const userNotificationEventSchema = z.enum([
  "request-submitted",
  "resource-created",
  "access-granted",
  "access-revoked",
  "resource-disposed",
  "api-key-issued",
  "api-key-replacement-approved",
  "api-key-disposal-approved",
  "access-policy-updated",
])
export type UserNotificationEvent = z.infer<typeof userNotificationEventSchema>
export const userNotificationTargetTypeSchema = z.enum([
  "approval-document",
  "access-policy",
])
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
  users: BackofficeUser[]
  roles: Role[]
  groups: Group[]
  approvalLines: ApprovalLine[]
  accessPolicies: AccessPolicy[]
  accessPolicyAssignments: AccessPolicyAssignment[]
  approvalDocuments: ApprovalDocument[]
  notifications: UserNotification[]
  services: ManagedService[]
  serviceEndpoints: ServiceEndpoint[]
  serviceEndpointFields: ServiceEndpointField[]
  apiKeys: ApiKey[]
  uiNamespaces: UiNamespace[]
  uiResources: UiResource[]
}
