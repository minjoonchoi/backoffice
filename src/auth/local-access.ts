import { resolveUiResourcePolicyAccess } from "@/auth/ui-resource-policy-access"
import {
  getMenuViewResourceKey,
  menuDefinitions,
  type MenuKey,
} from "@/config/menu-registry"
import type { BackofficeState } from "@/application/state/model"

type AccessState = Pick<
  BackofficeState,
  | "accessPolicies"
  | "accessPolicyAssignments"
  | "groups"
  | "roles"
  | "uiNamespaces"
  | "uiResources"
  | "users"
>

export type BackofficeAccess = Readonly<{
  roleIds: readonly string[]
  menuIds: readonly MenuKey[]
}>

export function resolveAccessibleMenuIds(
  resourceKeys: readonly string[],
): MenuKey[] {
  const resourceKeySet = new Set(resourceKeys)
  return menuDefinitions
    .filter((menu) =>
      resourceKeySet.has(getMenuViewResourceKey(menu.id, menu.defaultView)),
    )
    .map((menu) => menu.id)
}

export function resolveBackofficeAccess(
  state: AccessState,
  userId: string,
): BackofficeAccess {
  const access = resolveUiResourcePolicyAccess(state, userId)
  return {
    roleIds: access.roleIds,
    menuIds: resolveAccessibleMenuIds(access.resourceKeys),
  }
}
