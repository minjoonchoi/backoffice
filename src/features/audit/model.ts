export const auditResourceTypeValues = {
  user: "user",
  organization: "organization",
  application: "application",
  role: "role",
  accessPolicy: "access-policy",
  credential: "credential",
  service: "service",
  endpoint: "endpoint",
  namespace: "namespace",
  uiResource: "ui-resource",
  requestTemplate: "request-template",
  approvalRequest: "approval-request",
} as const
export const auditActionValues = {
  created: "created",
  updated: "updated",
  deleted: "deleted",
} as const
export const auditResourceTypes = Object.values(auditResourceTypeValues)
export const auditTypeFilterValues = { all: "all" } as const

export type AuditResourceType = (typeof auditResourceTypes)[number]
export type AuditAction =
  (typeof auditActionValues)[keyof typeof auditActionValues]

export type AuditFieldChange = Readonly<{
  field: string
  before: string | null
  after: string | null
}>

export type AuditImpact = Readonly<{
  permissionChangedUserIds: readonly string[]
  gainedPermissionCount: number
  lostPermissionCount: number
  relatedPolicyIds: readonly string[]
}>

export type AuditEvent = Readonly<{
  id: string
  actorUserId: string | null
  resourceType: AuditResourceType
  action: AuditAction
  targetId: string
  targetName: string
  changes: readonly AuditFieldChange[]
  impact: AuditImpact
  createdAt: string
}>
