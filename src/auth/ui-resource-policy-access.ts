import { uiResourceManifest } from "@/config/menu-registry"
import { resolveAuthorizationSubject } from "@/auth/authorization-subject"
import type { BackofficeState } from "@/application/state/model"
import type { AccessPolicyAssignmentTarget } from "@/features/access-policies/model"
import { resolveUiResourceVisibilities } from "@/features/ui-resources/ui-resource-visibility"

type UiResourcePolicyAccessState = Pick<
  BackofficeState,
  | "accessPolicies"
  | "accessPolicyAssignments"
  | "groups"
  | "roles"
  | "uiNamespaces"
  | "uiResources"
  | "users"
>

export type UiResourcePolicyGrant = Readonly<{
  policyId: string
  resourceId: string
  resourceKey: string
  effect: "allow" | "deny"
  targetType: AccessPolicyAssignmentTarget
  targetId: string
}>

export type UiResourcePolicyAccess = Readonly<{
  roleIds: readonly string[]
  resourceKeys: readonly string[]
  grants: readonly UiResourcePolicyGrant[]
}>

const noAccess: UiResourcePolicyAccess = Object.freeze({
  roleIds: Object.freeze([]),
  resourceKeys: Object.freeze([]),
  grants: Object.freeze([]),
})

function matchesTarget(
  targetType: AccessPolicyAssignmentTarget,
  targetId: string,
  userId: string,
  organizationIds: ReadonlySet<string>,
  roleIds: ReadonlySet<string>,
  groupIds: ReadonlySet<string>,
) {
  if (targetType === "user") return targetId === userId
  if (targetType === "organization") return organizationIds.has(targetId)
  if (targetType === "role") return roleIds.has(targetId)
  return groupIds.has(targetId)
}

export function resolveUiResourcePolicyAccess(
  state: UiResourcePolicyAccessState,
  userId: string,
  namespaceKey = uiResourceManifest.namespaceKey,
): UiResourcePolicyAccess {
  const subject = resolveAuthorizationSubject(state, userId)
  if (!subject) return noAccess
  const namespace = state.uiNamespaces.find(
    (candidate) =>
      candidate.key === namespaceKey && candidate.status === "active",
  )
  if (!namespace) {
    return { roleIds: [...subject.roleIds], resourceKeys: [], grants: [] }
  }

  const namespaceResources = state.uiResources.filter(
    (resource) => resource.namespaceId === namespace.id,
  )
  const visibilities = resolveUiResourceVisibilities(namespaceResources)
  const resources = namespaceResources.filter(
    (resource) => visibilities.get(resource.id) === "visible",
  )
  const resourcesById = new Map(
    resources.map((resource) => [resource.id, resource]),
  )
  const resourcesByKey = new Map(
    resources.map((resource) => [resource.key, resource]),
  )
  const policiesById = new Map(
    state.accessPolicies
      .filter((policy) => policy.status === "active")
      .map((policy) => [policy.id, policy]),
  )
  const grants: UiResourcePolicyGrant[] = []

  for (const assignment of state.accessPolicyAssignments) {
    if (
      !matchesTarget(
        assignment.targetType,
        assignment.targetId,
        subject.user.id,
        subject.organizationIds,
        subject.roleIds,
        subject.groupIds,
      )
    ) {
      continue
    }
    const policy = policiesById.get(assignment.accessPolicyId)
    if (!policy) continue
    for (const reference of policy.resources) {
      if (reference.type !== "ui-resource") continue
      const resource = resourcesById.get(reference.id)
      if (!resource) continue
      grants.push({
        policyId: policy.id,
        resourceId: resource.id,
        resourceKey: resource.key,
        effect: policy.effect,
        targetType: assignment.targetType,
        targetId: assignment.targetId,
      })
    }
  }

  const allowedKeys = new Set(
    grants
      .filter((grant) => grant.effect === "allow")
      .map((grant) => grant.resourceKey),
  )
  for (const key of [...allowedKeys]) {
    let parentKey = resourcesByKey.get(key)?.parentKey ?? null
    while (parentKey) {
      allowedKeys.add(parentKey)
      parentKey = resourcesByKey.get(parentKey)?.parentKey ?? null
    }
  }
  const deniedKeys = grants
    .filter((grant) => grant.effect === "deny")
    .map((grant) => grant.resourceKey)
  const resourceKeys = resources
    .map((resource) => resource.key)
    .filter(
      (key) =>
        allowedKeys.has(key) &&
        !deniedKeys.some(
          (deniedKey) => key === deniedKey || key.startsWith(`${deniedKey}:`),
        ),
    )

  return {
    roleIds: [...subject.roleIds],
    resourceKeys,
    grants,
  }
}

export function hasUiResourcePolicyAccess(
  state: UiResourcePolicyAccessState,
  userId: string,
  resourceKey: string,
  namespaceKey = uiResourceManifest.namespaceKey,
) {
  return resolveUiResourcePolicyAccess(
    state,
    userId,
    namespaceKey,
  ).resourceKeys.includes(resourceKey)
}

export type UiResourceAssignmentTargets = Readonly<{
  userIds: readonly string[]
  organizationIds: readonly string[]
  roleIds: readonly string[]
  groupIds: readonly string[]
}>

export function resolveUiResourceAssignmentTargets(
  state: Pick<
    BackofficeState,
    "accessPolicies" | "accessPolicyAssignments" | "uiResources"
  >,
  resourceKey: string,
): UiResourceAssignmentTargets {
  const resourceIds = new Set(
    state.uiResources
      .filter(
        (resource) =>
          resource.key === resourceKey && resource.orphanedAt === null,
      )
      .map((resource) => resource.id),
  )
  const policyIds = new Set(
    state.accessPolicies
      .filter(
        (policy) =>
          policy.status === "active" &&
          policy.effect === "allow" &&
          policy.resources.some(
            (resource) =>
              resource.type === "ui-resource" && resourceIds.has(resource.id),
          ),
      )
      .map((policy) => policy.id),
  )
  const targets = {
    userIds: new Set<string>(),
    organizationIds: new Set<string>(),
    roleIds: new Set<string>(),
    groupIds: new Set<string>(),
  }
  for (const assignment of state.accessPolicyAssignments) {
    if (!policyIds.has(assignment.accessPolicyId)) continue
    if (assignment.targetType === "user") {
      targets.userIds.add(assignment.targetId)
    } else if (assignment.targetType === "organization") {
      targets.organizationIds.add(assignment.targetId)
    } else if (assignment.targetType === "role") {
      targets.roleIds.add(assignment.targetId)
    } else {
      targets.groupIds.add(assignment.targetId)
    }
  }
  return {
    userIds: [...targets.userIds],
    organizationIds: [...targets.organizationIds],
    roleIds: [...targets.roleIds],
    groupIds: [...targets.groupIds],
  }
}
