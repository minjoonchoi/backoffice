import type { BackofficeState } from "@/application/state/model"
import { resolveAuthorizationSubject } from "@/auth/authorization-subject"
import { entityStatuses } from "@/domain/common"

type UiResourceAccessState = Pick<
  BackofficeState,
  "roles" | "namespaces" | "users"
>

export type UiResourceAccess = Readonly<{
  manageableNamespaceIds: readonly string[]
}>

const noAccess: UiResourceAccess = Object.freeze({
  manageableNamespaceIds: Object.freeze([]),
})

export function resolveUiResourceAccess(
  state: UiResourceAccessState,
  userId: string,
): UiResourceAccess {
  const subject = resolveAuthorizationSubject(state, userId)
  if (!subject) return noAccess
  const activeNamespaces = state.namespaces.filter(
    (namespace) => namespace.status === entityStatuses.active,
  )
  const manageableNamespaceIds = activeNamespaces
    .filter((namespace) => subject.roleIds.has(namespace.managerRoleId))
    .map((namespace) => namespace.id)
  if (manageableNamespaceIds.length === 0) return noAccess

  return { manageableNamespaceIds }
}

export function canManageNamespace(
  state: UiResourceAccessState,
  userId: string,
  namespaceId: string,
): boolean {
  return resolveUiResourceAccess(state, userId).manageableNamespaceIds.includes(
    namespaceId,
  )
}
