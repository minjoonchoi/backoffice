import { accessPolicyResourceTypes } from "@/features/access-policies/model"
import type { BackofficeState } from "@/application/state/model"
import { hasEffectiveAccessPolicyResource } from "@/features/access-policies/access-policy-assignment"
import type { AccessPolicyResource } from "@/features/access-policies/model"
import type {
  AuditAction,
  AuditEvent,
  AuditFieldChange,
  AuditImpact,
  AuditResourceType,
} from "@/features/audit/model"
import {
  auditActionValues,
  auditResourceTypeValues,
} from "@/features/audit/model"

type AuditSnapshot = Readonly<Record<string, string | null>>
type AuditEventDraft = Readonly<{
  resourceType: AuditResourceType
  action: AuditAction
  targetId: string
  targetName: string
  changes: readonly AuditFieldChange[]
}>

type AuditableEntity = Readonly<{ id: string }>

type AuditableEndpoint = BackofficeState["serviceEndpoints"][number] &
  Readonly<{ fieldConfiguration: string }>

function auditableCredentialLifecycleSettings(state: BackofficeState) {
  return [
    {
      id: "credential-lifecycle-settings",
      ...state.credentialLifecycleSettings,
    },
  ]
}

type AuditDescriptor<Entity extends AuditableEntity> = Readonly<{
  resourceType: AuditResourceType
  name: (entity: Entity) => string
  snapshot: (entity: Entity) => AuditSnapshot
}>

function sorted(values: readonly string[]) {
  return [...values].toSorted().join(", ")
}

function changesBetween(
  before: AuditSnapshot | null,
  after: AuditSnapshot | null,
): readonly AuditFieldChange[] {
  const fields = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])
  return [...fields].flatMap((field) => {
    const previous = before?.[field] ?? null
    const next = after?.[field] ?? null
    return previous === next ? [] : [{ field, before: previous, after: next }]
  })
}

function diffCollection<Entity extends AuditableEntity>(
  before: readonly Entity[],
  after: readonly Entity[],
  descriptor: AuditDescriptor<Entity>,
): readonly AuditEventDraft[] {
  const beforeById = new Map(before.map((entity) => [entity.id, entity]))
  const afterById = new Map(after.map((entity) => [entity.id, entity]))
  const ids = new Set([...beforeById.keys(), ...afterById.keys()])

  return [...ids].flatMap((id) => {
    const previous = beforeById.get(id)
    const next = afterById.get(id)
    if (!previous && !next) return []
    const changes = changesBetween(
      previous ? descriptor.snapshot(previous) : null,
      next ? descriptor.snapshot(next) : null,
    )
    if (changes.length === 0) return []
    const entity = next ?? previous
    if (!entity) return []
    return [
      {
        resourceType: descriptor.resourceType,
        action: previous
          ? next
            ? auditActionValues.updated
            : auditActionValues.deleted
          : auditActionValues.created,
        targetId: id,
        targetName: descriptor.name(entity),
        changes,
      },
    ]
  })
}

function auditableEndpoints(state: BackofficeState): AuditableEndpoint[] {
  return state.serviceEndpoints.map((endpoint) => ({
    ...endpoint,
    fieldConfiguration: state.serviceEndpointFields
      .filter((field) => field.endpointId === endpoint.id)
      .map((field) =>
        [
          field.location,
          field.fieldPath,
          field.valueType,
          String(field.required),
          field.description,
        ].join(":"),
      )
      .toSorted()
      .join(", "),
  }))
}

function uniquePolicyResources(
  before: BackofficeState,
  after: BackofficeState,
): readonly AccessPolicyResource[] {
  const resources: AccessPolicyResource[] = []
  for (const resource of [
    ...before.accessPolicies,
    ...after.accessPolicies,
  ].flatMap((policy) => policy.resources)) {
    if (
      !resources.some(
        (candidate) =>
          candidate.type === resource.type && candidate.id === resource.id,
      )
    ) {
      resources.push(resource)
    }
  }
  return resources
}

function resolvePermissionImpact(
  before: BackofficeState,
  after: BackofficeState,
) {
  const resources = uniquePolicyResources(before, after)
  const userIds = new Set([
    ...before.users.map((user) => user.id),
    ...after.users.map((user) => user.id),
  ])
  let gainedPermissionCount = 0
  let lostPermissionCount = 0
  const permissionChangedUserIds: string[] = []
  const now = new Date()

  for (const userId of userIds) {
    let userChanged = false
    for (const resource of resources) {
      const allowedBefore = hasEffectiveAccessPolicyResource(
        before,
        userId,
        resource,
        now,
      )
      const allowedAfter = hasEffectiveAccessPolicyResource(
        after,
        userId,
        resource,
        now,
      )
      if (!allowedBefore && allowedAfter) {
        gainedPermissionCount += 1
        userChanged = true
      }
      if (allowedBefore && !allowedAfter) {
        lostPermissionCount += 1
        userChanged = true
      }
    }
    if (userChanged) permissionChangedUserIds.push(userId)
  }

  return {
    permissionChangedUserIds,
    gainedPermissionCount,
    lostPermissionCount,
  }
}

function relatedPolicyIds(
  event: AuditEventDraft,
  before: BackofficeState,
  after: BackofficeState,
) {
  const policies = [...before.accessPolicies, ...after.accessPolicies]
  const endpointIds =
    event.resourceType === auditResourceTypeValues.service
      ? new Set(
          [...before.serviceEndpoints, ...after.serviceEndpoints]
            .filter((endpoint) => endpoint.serviceId === event.targetId)
            .map((endpoint) => endpoint.id),
        )
      : event.resourceType === auditResourceTypeValues.credential
        ? new Set(
            [...before.apiKeys, ...after.apiKeys]
              .filter((credential) => credential.id === event.targetId)
              .flatMap((credential) => credential.endpointIds),
          )
        : new Set<string>()

  return [
    ...new Set(
      policies.flatMap((policy) => {
        if (
          event.resourceType === auditResourceTypeValues.accessPolicy &&
          policy.id === event.targetId
        ) {
          return [policy.id]
        }
        const referenced = policy.resources.some((resource) =>
          event.resourceType === auditResourceTypeValues.endpoint
            ? resource.type === accessPolicyResourceTypes.endpoint &&
              resource.id === event.targetId
            : event.resourceType === auditResourceTypeValues.uiResource
              ? resource.type === accessPolicyResourceTypes.uiResource &&
                resource.id === event.targetId
              : event.resourceType === auditResourceTypeValues.service ||
                  event.resourceType === auditResourceTypeValues.credential
                ? resource.type === accessPolicyResourceTypes.endpoint &&
                  endpointIds.has(resource.id)
                : false,
        )
        return referenced ? [policy.id] : []
      }),
    ),
  ]
}

export function createAuditEvents(
  before: BackofficeState,
  after: BackofficeState,
  actorUserId: string | null,
): readonly AuditEvent[] {
  const drafts: AuditEventDraft[] = [
    ...diffCollection(before.users, after.users, {
      resourceType: auditResourceTypeValues.user,
      name: (user) => user.nickname,
      snapshot: (user) => ({
        nickname: user.nickname,
        email: user.email,
        employmentStatus: user.employmentStatus,
        organizationIds: sorted(user.organizationIds),
      }),
    }),
    ...diffCollection(before.organizations, after.organizations, {
      resourceType: auditResourceTypeValues.organization,
      name: (organization) => organization.name,
      snapshot: (organization) => ({
        name: organization.name,
        leaderUserId: organization.leaderUserId,
        parentId: organization.parentId ?? null,
      }),
    }),
    ...diffCollection(before.applications, after.applications, {
      resourceType: auditResourceTypeValues.application,
      name: (application) => application.name,
      snapshot: (application) => ({
        name: application.name,
        slug: application.slug,
        description: application.description,
        ownerOrganizationId: application.ownerOrganizationId,
      }),
    }),
    ...diffCollection(before.roles, after.roles, {
      resourceType: auditResourceTypeValues.role,
      name: (role) => role.name,
      snapshot: (role) => ({
        name: role.name,
        description: role.description,
        userIds: sorted(role.userIds),
        organizationIds: sorted(role.organizationIds),
      }),
    }),
    ...diffCollection(before.approvalLines, after.approvalLines, {
      resourceType: auditResourceTypeValues.requestTemplate,
      name: (template) => template.name,
      snapshot: (template) => ({
        name: template.name,
        category: template.category,
        type: template.type,
        version: String(template.version),
        status: template.status,
        steps: template.steps
          .map(
            (step) => `${String(step.stage)}:${step.kind}:${step.assigneeMode}`,
          )
          .join(", "),
        fields: template.fields
          .map(
            (field) =>
              `${field.key}:${field.binding}:${String(field.required)}`,
          )
          .join(", "),
      }),
    }),
    ...diffCollection(before.accessPolicies, after.accessPolicies, {
      resourceType: auditResourceTypeValues.accessPolicy,
      name: (policy) => policy.name,
      snapshot: (policy) => ({
        name: policy.name,
        description: policy.description,
        effect: policy.effect,
        status: policy.status,
        resources: policy.resources
          .map((resource) => `${resource.type}:${resource.id}`)
          .toSorted()
          .join(", "),
      }),
    }),
    ...diffCollection(
      before.accessPolicyAssignments,
      after.accessPolicyAssignments,
      {
        resourceType: auditResourceTypeValues.accessPolicy,
        name: (assignment) => `정책 부여 · ${assignment.targetType}`,
        snapshot: (assignment) => ({
          accessPolicyId: assignment.accessPolicyId,
          targetType: assignment.targetType,
          targetId: assignment.targetId,
          expiresAt: assignment.expiresAt,
        }),
      },
    ),
    ...diffCollection(before.approvalDocuments, after.approvalDocuments, {
      resourceType: auditResourceTypeValues.approvalRequest,
      name: (request) => request.title,
      snapshot: (request) => ({
        title: request.title,
        type: request.type,
        status: request.status,
        requesterId: request.requesterId,
        organizationId: request.organizationId,
        approvalLineId: request.approvalLineId,
        approvalSteps: request.approvalSteps
          .map((step) => `${String(step.stage)}:${step.kind}:${step.status}`)
          .join(", "),
        historyCount: String(request.history.length),
      }),
    }),
    ...diffCollection(before.services, after.services, {
      resourceType: auditResourceTypeValues.service,
      name: (service) => service.name,
      snapshot: (service) => ({
        name: service.name,
        slug: service.slug,
        host: service.host,
        type: service.type,
        ownerOrganizationId: service.ownerOrganizationId,
        status: service.status,
      }),
    }),
    ...diffCollection(auditableEndpoints(before), auditableEndpoints(after), {
      resourceType: auditResourceTypeValues.endpoint,
      name: (endpoint) => endpoint.name,
      snapshot: (endpoint) => ({
        serviceId: endpoint.serviceId,
        name: endpoint.name,
        method: endpoint.method,
        path: endpoint.path,
        version: endpoint.version,
        lifecycle: endpoint.lifecycle,
        fields: endpoint.fieldConfiguration,
      }),
    }),
    ...diffCollection(before.apiKeys, after.apiKeys, {
      resourceType: auditResourceTypeValues.credential,
      name: (credential) => credential.name,
      snapshot: (credential) => ({
        applicationId: credential.applicationId,
        accessPolicyId: credential.accessPolicyId,
        serviceId: credential.serviceId,
        endpointIds: sorted(credential.endpointIds),
        status: credential.status,
        expiresAt: credential.expiresAt,
        nextRotationAt: credential.nextRotationAt,
        usageSystemNames: sorted(credential.usageSystemNames),
        emergencyRevokedAt: credential.emergencyRevokedAt,
        emergencyRevokeReason: credential.emergencyRevokeReason,
      }),
    }),
    ...diffCollection(
      before.credentialRegistrationAttempts,
      after.credentialRegistrationAttempts,
      {
        resourceType: auditResourceTypeValues.credential,
        name: (attempt) =>
          `Credential registration attempt ${String(attempt.attemptNumber)}`,
        snapshot: (attempt) => ({
          approvalDocumentId: attempt.approvalDocumentId,
          serviceId: attempt.serviceId,
          registeredByUserId: attempt.registeredByUserId,
          apiKeyId: attempt.apiKeyId,
          attemptNumber: String(attempt.attemptNumber),
          status: attempt.status,
          errorCode: attempt.errorCode,
        }),
      },
    ),
    ...diffCollection(
      auditableCredentialLifecycleSettings(before),
      auditableCredentialLifecycleSettings(after),
      {
        resourceType: auditResourceTypeValues.credential,
        name: () => "Credential lifecycle settings",
        snapshot: (settings) => ({
          expirationPeriodDays: String(settings.expirationPeriodDays),
          rotationIntervalDays: String(settings.rotationIntervalDays),
          updatedByUserId: settings.updatedByUserId,
        }),
      },
    ),
    ...diffCollection(before.namespaces, after.namespaces, {
      resourceType: auditResourceTypeValues.namespace,
      name: (namespace) => namespace.name,
      snapshot: (namespace) => ({
        key: namespace.key,
        name: namespace.name,
        description: namespace.description,
        managerRoleId: namespace.managerRoleId,
        managerAccessPolicyId: namespace.managerAccessPolicyId,
        status: namespace.status,
        lastSyncedAt: namespace.lastSyncedAt,
      }),
    }),
    ...diffCollection(before.uiResources, after.uiResources, {
      resourceType: auditResourceTypeValues.uiResource,
      name: (resource) => resource.name,
      snapshot: (resource) => ({
        namespaceId: resource.namespaceId,
        key: resource.key,
        parentKey: resource.parentKey,
        type: resource.type,
        name: resource.name,
        description: resource.description,
        status: resource.status,
        orphanedAt: resource.orphanedAt,
      }),
    }),
    ...diffCollection(
      before.uiResourceSyncHistories,
      after.uiResourceSyncHistories,
      {
        resourceType: auditResourceTypeValues.uiResource,
        name: (history) => `동기화 · ${history.synchronizedAt}`,
        snapshot: (history) => ({
          namespaceId: history.namespaceId,
          synchronizedByUserId: history.synchronizedByUserId,
          grantManagerAccess: String(history.grantManagerAccess),
          addedCount: String(history.addedCount),
          updatedCount: String(history.updatedCount),
          restoredCount: String(history.restoredCount),
          orphanedCount: String(history.orphanedCount),
          resourceCount: String(history.resources.length),
        }),
      },
    ),
  ]
  if (drafts.length === 0) return []

  const permissionImpact = resolvePermissionImpact(before, after)
  const createdAt = new Date().toISOString()
  return drafts.map((draft) => {
    const impact: AuditImpact = {
      ...permissionImpact,
      relatedPolicyIds: relatedPolicyIds(draft, before, after),
    }
    return {
      ...draft,
      id: crypto.randomUUID(),
      actorUserId,
      impact,
      createdAt,
    }
  })
}
