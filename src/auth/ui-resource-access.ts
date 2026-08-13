import type { BackofficeState } from "@/application/state/model"
import { resolveAuthorizationSubject } from "@/auth/authorization-subject"
import { hasEffectiveAccessPolicyResource } from "@/features/access-policies/access-policy-assignment"

type UiResourceAccessState = Pick<
  BackofficeState,
  | "accessPolicies"
  | "accessPolicyAssignments"
  | "groups"
  | "roles"
  | "uiNamespaces"
  | "users"
>

export type UiResourceAccess = Readonly<{
  isManager: boolean
  administratorNamespaceIds: readonly string[]
  manageableNamespaceIds: readonly string[]
}>

const noAccess: UiResourceAccess = Object.freeze({
  isManager: false,
  administratorNamespaceIds: Object.freeze([]),
  manageableNamespaceIds: Object.freeze([]),
})

export function resolveUiResourceAccess(
  state: UiResourceAccessState,
  userId: string,
): UiResourceAccess {
  const subject = resolveAuthorizationSubject(state, userId)
  if (!subject) return noAccess
  const activeNamespaces = state.uiNamespaces.filter(
    (namespace) => namespace.status === "active",
  )
  const administratorNamespaceIds = activeNamespaces
    .filter(
      (namespace) =>
        subject.roleIds.has(namespace.administratorRoleId) &&
        hasEffectiveAccessPolicyResource(state, userId, {
          type: "ui-namespace",
          id: namespace.id,
        }),
    )
    .map((namespace) => namespace.id)
  const manageableNamespaceIds = activeNamespaces
    .filter((namespace) =>
      hasEffectiveAccessPolicyResource(state, userId, {
        type: "ui-namespace",
        id: namespace.id,
      }),
    )
    .map((namespace) => namespace.id)
  if (manageableNamespaceIds.length === 0) return noAccess

  return {
    isManager: manageableNamespaceIds.some(
      (namespaceId) => !administratorNamespaceIds.includes(namespaceId),
    ),
    administratorNamespaceIds,
    manageableNamespaceIds,
  }
}

export function resolveUiNamespaceAdministratorResourceIds(
  state: Pick<
    BackofficeState,
    | "accessPolicies"
    | "accessPolicyAssignments"
    | "uiNamespaces"
    | "uiResources"
  >,
  namespaceId: string,
): readonly string[] {
  const namespace = state.uiNamespaces.find(
    (candidate) => candidate.id === namespaceId,
  )
  if (namespace?.status !== "active") return []
  const assignedPolicyIds = new Set(
    state.accessPolicyAssignments
      .filter(
        (assignment) =>
          assignment.targetType === "role" &&
          assignment.targetId === namespace.administratorRoleId,
      )
      .map((assignment) => assignment.accessPolicyId),
  )
  const resources = state.uiResources.filter(
    (resource) =>
      resource.namespaceId === namespace.id && resource.orphanedAt === null,
  )
  const resourcesById = new Map(
    resources.map((resource) => [resource.id, resource]),
  )
  const resourcesByKey = new Map(
    resources.map((resource) => [resource.key, resource]),
  )
  const allowedKeys = new Set<string>()
  const deniedKeys = new Set<string>()
  for (const policy of state.accessPolicies) {
    if (policy.status !== "active" || !assignedPolicyIds.has(policy.id)) {
      continue
    }
    for (const reference of policy.resources) {
      if (reference.type !== "ui-resource") continue
      const resource = resourcesById.get(reference.id)
      if (!resource) continue
      if (policy.effect === "deny") deniedKeys.add(resource.key)
      else allowedKeys.add(resource.key)
    }
  }
  for (const key of [...allowedKeys]) {
    let parentKey = resourcesByKey.get(key)?.parentKey ?? null
    while (parentKey) {
      allowedKeys.add(parentKey)
      parentKey = resourcesByKey.get(parentKey)?.parentKey ?? null
    }
  }
  return resources.flatMap((resource) =>
    allowedKeys.has(resource.key) &&
    ![...deniedKeys].some(
      (deniedKey) =>
        resource.key === deniedKey || resource.key.startsWith(`${deniedKey}:`),
    )
      ? [resource.id]
      : [],
  )
}

export function canManageUiNamespace(
  state: UiResourceAccessState,
  userId: string,
  namespaceId: string,
): boolean {
  return resolveUiResourceAccess(state, userId).manageableNamespaceIds.includes(
    namespaceId,
  )
}
