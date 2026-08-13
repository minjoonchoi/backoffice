"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { z } from "zod"

import { resolveAccessibleMenuIds } from "@/auth/local-access"
import { resolveUiResourcePolicyAccess } from "@/auth/ui-resource-policy-access"
import type { BackofficeUiResourceKey, MenuKey } from "@/config/menu-registry"
import { resolveAssignedAccessPolicyIds } from "@/features/access-policies/access-policy-assignment"
import type { BackofficeUser, Role } from "@/features/iam/model"
import { useBackoffice } from "@/application/state/provider"
import { resolveOwnedCredentialIds } from "@/features/credentials/credential-ownership"

export type SessionUserOption = Readonly<{
  id: string
  displayName: string
  organizationNames: readonly string[]
}>

type SessionAccessContextValue = Readonly<{
  localSwitchingEnabled: boolean
  currentUser: BackofficeUser | null
  userOptions: readonly SessionUserOption[]
  organizationNames: readonly string[]
  effectiveRoles: readonly Role[]
  groupNames: readonly string[]
  accessibleMenuIds: readonly MenuKey[]
  accessibleUiResourceKeys: readonly string[]
  assignedAccessPolicyIds: readonly string[]
  ownedCredentialIds: readonly string[]
  ownedCredentialServiceIds: readonly string[]
  canAccessUiResource: (resourceKey: BackofficeUiResourceKey) => boolean
  switchUser: (userId: unknown) => boolean
}>

const userIdSchema = z.uuid()
const unavailableSessionAccess: SessionAccessContextValue = {
  localSwitchingEnabled: false,
  currentUser: null,
  userOptions: [],
  organizationNames: [],
  effectiveRoles: [],
  groupNames: [],
  accessibleMenuIds: [],
  accessibleUiResourceKeys: [],
  assignedAccessPolicyIds: [],
  ownedCredentialIds: [],
  ownedCredentialServiceIds: [],
  canAccessUiResource: () => false,
  switchUser: () => false,
}

const SessionAccessContext = createContext<SessionAccessContextValue>(
  unavailableSessionAccess,
)

export function SessionAccessProvider({
  children,
  localSwitchingEnabled,
  initialUserId,
}: {
  children: ReactNode
  localSwitchingEnabled: boolean
  initialUserId?: string
}) {
  const backoffice = useBackoffice()
  const [localLoginUserIds] = useState(
    () => new Set(backoffice.users.map((user) => user.id)),
  )
  const [currentUserId, setCurrentUserId] = useState(initialUserId)
  const currentUser = localLoginUserIds.has(currentUserId ?? "")
    ? (backoffice.users.find((user) => user.id === currentUserId) ?? null)
    : null
  const uiResourceAccess = useMemo(
    () =>
      currentUser
        ? resolveUiResourcePolicyAccess(backoffice, currentUser.id)
        : { roleIds: [], resourceKeys: [], grants: [] },
    [currentUser, backoffice],
  )
  const accessibleMenuIds = useMemo(
    () => resolveAccessibleMenuIds(uiResourceAccess.resourceKeys),
    [uiResourceAccess.resourceKeys],
  )
  const effectiveRoles = useMemo(
    () =>
      backoffice.roles.filter((role) =>
        uiResourceAccess.roleIds.includes(role.id),
      ),
    [uiResourceAccess.roleIds, backoffice.roles],
  )
  const accessibleUiResourceKeySet = useMemo(
    () => new Set(uiResourceAccess.resourceKeys),
    [uiResourceAccess.resourceKeys],
  )
  const assignedAccessPolicyIds = useMemo(
    () =>
      currentUser
        ? resolveAssignedAccessPolicyIds(backoffice, currentUser.id)
        : [],
    [currentUser, backoffice],
  )
  const ownedCredentialIds = useMemo(
    () => resolveOwnedCredentialIds(backoffice, currentUser?.id ?? null),
    [currentUser?.id, backoffice],
  )
  const ownedCredentialIdSet = useMemo(
    () => new Set(ownedCredentialIds),
    [ownedCredentialIds],
  )
  const ownedCredentialServiceIds = useMemo(
    () => [
      ...new Set(
        backoffice.apiKeys
          .filter((credential) => ownedCredentialIdSet.has(credential.id))
          .map((credential) => credential.serviceId),
      ),
    ],
    [backoffice.apiKeys, ownedCredentialIdSet],
  )
  const canAccessUiResource = useCallback(
    (resourceKey: BackofficeUiResourceKey) =>
      accessibleUiResourceKeySet.has(resourceKey),
    [accessibleUiResourceKeySet],
  )
  const organizationNames = useMemo(
    () =>
      currentUser
        ? backoffice.organizations
            .filter((organization) =>
              currentUser.organizationIds.includes(organization.id),
            )
            .map((organization) => organization.name)
        : [],
    [currentUser, backoffice.organizations],
  )
  const groupNames = useMemo(
    () =>
      currentUser
        ? backoffice.groups
            .filter((group) => group.userIds.includes(currentUser.id))
            .map((group) => group.name)
        : [],
    [currentUser, backoffice.groups],
  )
  const userOptions = useMemo(
    () =>
      localSwitchingEnabled
        ? backoffice.users
            .filter((user) => localLoginUserIds.has(user.id))
            .map((user) => ({
              id: user.id,
              displayName: user.nickname,
              organizationNames: backoffice.organizations
                .filter((organization) =>
                  user.organizationIds.includes(organization.id),
                )
                .map((organization) => organization.name),
            }))
        : [],
    [
      localSwitchingEnabled,
      backoffice.organizations,
      backoffice.users,
      localLoginUserIds,
    ],
  )
  const switchUser = useCallback(
    (input: unknown) => {
      const parsed = userIdSchema.safeParse(input)
      if (
        !localSwitchingEnabled ||
        !parsed.success ||
        !localLoginUserIds.has(parsed.data) ||
        !backoffice.users.some((user) => user.id === parsed.data)
      ) {
        return false
      }
      setCurrentUserId(parsed.data)
      return true
    },
    [localSwitchingEnabled, backoffice.users, localLoginUserIds],
  )
  const value = useMemo<SessionAccessContextValue>(
    () => ({
      localSwitchingEnabled,
      currentUser,
      userOptions,
      organizationNames,
      effectiveRoles,
      groupNames,
      accessibleMenuIds,
      accessibleUiResourceKeys: uiResourceAccess.resourceKeys,
      assignedAccessPolicyIds,
      ownedCredentialIds,
      ownedCredentialServiceIds,
      canAccessUiResource,
      switchUser,
    }),
    [
      accessibleMenuIds,
      assignedAccessPolicyIds,
      canAccessUiResource,
      currentUser,
      effectiveRoles,
      localSwitchingEnabled,
      groupNames,
      organizationNames,
      ownedCredentialIds,
      ownedCredentialServiceIds,
      switchUser,
      uiResourceAccess.resourceKeys,
      userOptions,
    ],
  )

  return (
    <SessionAccessContext.Provider value={value}>
      {children}
    </SessionAccessContext.Provider>
  )
}

export function useSessionAccess() {
  return useContext(SessionAccessContext)
}
