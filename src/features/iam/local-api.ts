import type { IamApi } from "@/features/iam/api"
import { hasUiResourcePolicyAccess } from "@/auth/ui-resource-policy-access"
import { uiResourceKeys } from "@/config/menu-registry"
import { entityIdListSchema } from "@/domain/common"
import {
  createRecordBase,
  type BackofficeStateUpdater,
} from "@/application/api/local-state"
import type { BackofficeState } from "@/application/state/model"
import {
  isSystemManagedGroup,
  isSystemManagedRole,
  isSystemGroup,
  isSystemRole,
  type BackofficeSystemReferences,
} from "@/domain/system-references"
import {
  employmentStatusSchema,
  groupInputSchema,
  organizationInputSchema,
  roleInputSchema,
  userInputSchema,
  type BackofficeUser,
  type Group,
  type Organization,
  type Role,
} from "@/features/iam/model"

export function synchronizeOrganizationLeaderGroup(
  groups: Group[],
  organizations: Organization[],
  systemReferences: BackofficeSystemReferences,
) {
  const leaderUserIds = [
    ...new Set(organizations.map((organization) => organization.leaderUserId)),
  ]
  return groups.map((group) =>
    group.id === systemReferences.groupIds.organizationLeader
      ? { ...group, userIds: leaderUserIds }
      : group,
  )
}

export function synchronizeGeneralUserRole(
  roles: Role[],
  users: BackofficeUser[],
  systemReferences: BackofficeSystemReferences,
) {
  const userIds = users.map((user) => user.id)
  return roles.map((role) =>
    role.id === systemReferences.roleIds.generalUser
      ? { ...role, userIds }
      : role,
  )
}

function createsOrganizationCycle(
  organizations: Organization[],
  organizationId: string,
  parentId: string | undefined,
) {
  let currentId = parentId
  while (currentId) {
    if (currentId === organizationId) return true
    currentId = organizations.find((item) => item.id === currentId)?.parentId
  }
  return false
}

function validateIds(
  values: unknown,
  records: readonly { id: string }[],
  missingError:
    | "user-not-found"
    | "organization-not-found"
    | "role-not-found"
    | "group-not-found",
) {
  const parsed = entityIdListSchema.safeParse(values)
  if (!parsed.success) return { ok: false, error: "invalid-input" } as const
  if (!parsed.data.every((id) => records.some((record) => record.id === id))) {
    return { ok: false, error: missingError } as const
  }
  return { ok: true, ids: parsed.data } as const
}

export function createLocalIamApi(
  state: BackofficeState,
  updateState: BackofficeStateUpdater,
): IamApi {
  return {
    createOrganization: async (input) => {
      await Promise.resolve()
      const parsed = organizationInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (
        parsed.data.parentId &&
        !state.organizations.some(
          (organization) => organization.id === parsed.data.parentId,
        )
      ) {
        return { ok: false, error: "organization-not-found" }
      }
      const leader = state.users.find(
        (user) => user.id === parsed.data.leaderUserId,
      )
      if (leader?.employmentStatus !== "employed") {
        return { ok: false, error: "user-not-found" }
      }
      const organization = { ...parsed.data, ...createRecordBase() }
      updateState((current) => ({
        ...current,
        organizations: [...current.organizations, organization],
        groups: synchronizeOrganizationLeaderGroup(
          current.groups,
          [...current.organizations, organization],
          current.systemReferences,
        ),
        users: current.users.map((user) =>
          user.id === leader.id
            ? {
                ...user,
                organizationIds: [...user.organizationIds, organization.id],
              }
            : user,
        ),
      }))
      return { ok: true, value: organization }
    },

    updateOrganization: async (id, input) => {
      await Promise.resolve()
      const existing = state.organizations.find((item) => item.id === id)
      if (!existing) return { ok: false, error: "organization-not-found" }
      const parsed = organizationInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (
        parsed.data.parentId &&
        !state.organizations.some(
          (organization) => organization.id === parsed.data.parentId,
        )
      ) {
        return { ok: false, error: "organization-not-found" }
      }
      if (
        createsOrganizationCycle(state.organizations, id, parsed.data.parentId)
      ) {
        return { ok: false, error: "invalid-input" }
      }
      const leader = state.users.find(
        (user) => user.id === parsed.data.leaderUserId,
      )
      if (leader?.employmentStatus !== "employed") {
        return { ok: false, error: "user-not-found" }
      }
      const organization = {
        ...parsed.data,
        id,
        createdAt: existing.createdAt,
      }
      updateState((current) => ({
        ...current,
        organizations: current.organizations.map((item) =>
          item.id === id ? organization : item,
        ),
        groups: synchronizeOrganizationLeaderGroup(
          current.groups,
          current.organizations.map((item) =>
            item.id === id ? organization : item,
          ),
          current.systemReferences,
        ),
        users: current.users.map((user) =>
          user.id === leader.id && !user.organizationIds.includes(id)
            ? { ...user, organizationIds: [...user.organizationIds, id] }
            : user,
        ),
      }))
      return { ok: true, value: organization }
    },

    addUsersToOrganization: async (id, userIds) => {
      await Promise.resolve()
      if (!state.organizations.some((item) => item.id === id)) {
        return { ok: false, error: "organization-not-found" }
      }
      const usersResult = validateIds(userIds, state.users, "user-not-found")
      if (!usersResult.ok) return usersResult
      const selectedIds = new Set(usersResult.ids)
      const users = state.users.map((user) =>
        selectedIds.has(user.id) && !user.organizationIds.includes(id)
          ? { ...user, organizationIds: [...user.organizationIds, id] }
          : user,
      )
      updateState((current) => ({ ...current, users }))
      return {
        ok: true,
        value: users.filter((user) => selectedIds.has(user.id)),
      }
    },

    addOrganizationsToUser: async (id, organizationIds) => {
      await Promise.resolve()
      const existing = state.users.find((user) => user.id === id)
      if (!existing) return { ok: false, error: "user-not-found" }
      const organizationsResult = validateIds(
        organizationIds,
        state.organizations,
        "organization-not-found",
      )
      if (!organizationsResult.ok) return organizationsResult
      const idsToAdd = organizationsResult.ids.filter(
        (organizationId) => !existing.organizationIds.includes(organizationId),
      )
      const user = {
        ...existing,
        organizationIds: [...existing.organizationIds, ...idsToAdd],
      }
      updateState((current) => ({
        ...current,
        users: current.users.map((item) => (item.id === id ? user : item)),
      }))
      return { ok: true, value: user }
    },

    removeUsersFromOrganizations: async (userIds, organizationIds) => {
      await Promise.resolve()
      const usersResult = validateIds(userIds, state.users, "user-not-found")
      if (!usersResult.ok) return usersResult
      const organizationsResult = validateIds(
        organizationIds,
        state.organizations,
        "organization-not-found",
      )
      if (!organizationsResult.ok) return organizationsResult
      const selectedUserIds = new Set(usersResult.ids)
      const selectedOrganizationIds = new Set(organizationsResult.ids)
      if (
        state.organizations.some(
          (organization) =>
            selectedOrganizationIds.has(organization.id) &&
            selectedUserIds.has(organization.leaderUserId),
        ) ||
        state.users.some(
          (user) =>
            selectedUserIds.has(user.id) &&
            user.employmentStatus !== "resigned" &&
            user.organizationIds.every((organizationId) =>
              selectedOrganizationIds.has(organizationId),
            ),
        )
      ) {
        return { ok: false, error: "protected-relationship" }
      }
      const users = state.users.map((user) =>
        selectedUserIds.has(user.id)
          ? {
              ...user,
              organizationIds: user.organizationIds.filter(
                (organizationId) =>
                  !selectedOrganizationIds.has(organizationId),
              ),
            }
          : user,
      )
      updateState((current) => ({ ...current, users }))
      return {
        ok: true,
        value: users.filter((user) => selectedUserIds.has(user.id)),
      }
    },

    createUser: async (input) => {
      await Promise.resolve()
      const parsed = userInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (
        !parsed.data.organizationIds.every((organizationId) =>
          state.organizations.some(
            (organization) => organization.id === organizationId,
          ),
        )
      ) {
        return { ok: false, error: "organization-not-found" }
      }
      if (state.users.some((user) => user.email === parsed.data.email)) {
        return { ok: false, error: "user-email-exists" }
      }
      if (state.users.some((user) => user.nickname === parsed.data.nickname)) {
        return { ok: false, error: "user-nickname-exists" }
      }
      const user = { ...parsed.data, ...createRecordBase() }
      updateState((current) => {
        const users = [...current.users, user]
        return {
          ...current,
          users,
          roles: synchronizeGeneralUserRole(
            current.roles,
            users,
            current.systemReferences,
          ),
        }
      })
      return { ok: true, value: user }
    },

    createRole: async (input) => {
      await Promise.resolve()
      const parsed = roleInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      const normalizedName = parsed.data.name.toLocaleLowerCase()
      if (
        state.roles.some(
          (role) => role.name.toLocaleLowerCase() === normalizedName,
        )
      ) {
        return { ok: false, error: "role-name-exists" }
      }
      const role = {
        ...parsed.data,
        ...createRecordBase(),
        userIds: [],
        organizationIds: [],
      }
      updateState((current) => ({
        ...current,
        roles: [...current.roles, role],
      }))
      return { ok: true, value: role }
    },

    updateRole: async (id, input, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.roles.detail.actions.updateRole,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      const existing = state.roles.find((role) => role.id === id)
      if (!existing) return { ok: false, error: "role-not-found" }
      if (isSystemRole(state.systemReferences, id)) {
        return { ok: false, error: "protected-relationship" }
      }
      const parsed = roleInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      const normalizedName = parsed.data.name.toLocaleLowerCase()
      if (
        state.roles.some(
          (role) =>
            role.id !== id && role.name.toLocaleLowerCase() === normalizedName,
        )
      ) {
        return { ok: false, error: "role-name-exists" }
      }
      const role = { ...existing, ...parsed.data }
      updateState((current) => ({
        ...current,
        roles: current.roles.map((candidate) =>
          candidate.id === id ? role : candidate,
        ),
      }))
      return { ok: true, value: role }
    },

    deleteRole: async (id, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.roles.detail.actions.deleteRole,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      const role = state.roles.find((candidate) => candidate.id === id)
      if (!role) return { ok: false, error: "role-not-found" }
      if (isSystemRole(state.systemReferences, id)) {
        return { ok: false, error: "protected-relationship" }
      }
      const inUse =
        role.userIds.length > 0 ||
        role.organizationIds.length > 0 ||
        state.accessPolicyAssignments.some(
          (assignment) =>
            assignment.targetType === "role" && assignment.targetId === id,
        ) ||
        state.uiNamespaces.some(
          (namespace) => namespace.administratorRoleId === id,
        )
      if (inUse) return { ok: false, error: "role-in-use" }
      updateState((current) => ({
        ...current,
        roles: current.roles.filter((candidate) => candidate.id !== id),
      }))
      return { ok: true, value: role }
    },

    createGroup: async (input) => {
      await Promise.resolve()
      const parsed = groupInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      const normalizedName = parsed.data.name.toLocaleLowerCase()
      if (
        state.groups.some(
          (group) => group.name.toLocaleLowerCase() === normalizedName,
        )
      ) {
        return { ok: false, error: "group-name-exists" }
      }
      const group = { ...parsed.data, ...createRecordBase(), userIds: [] }
      updateState((current) => ({
        ...current,
        groups: [...current.groups, group],
      }))
      return { ok: true, value: group }
    },

    updateGroup: async (id, input, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.groups.detail.actions.updateGroup,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      const existing = state.groups.find((group) => group.id === id)
      if (!existing) return { ok: false, error: "group-not-found" }
      if (isSystemGroup(state.systemReferences, id)) {
        return { ok: false, error: "protected-relationship" }
      }
      const parsed = groupInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      const normalizedName = parsed.data.name.toLocaleLowerCase()
      if (
        state.groups.some(
          (group) =>
            group.id !== id &&
            group.name.toLocaleLowerCase() === normalizedName,
        )
      ) {
        return { ok: false, error: "group-name-exists" }
      }
      const group = { ...existing, ...parsed.data }
      updateState((current) => ({
        ...current,
        groups: current.groups.map((candidate) =>
          candidate.id === id ? group : candidate,
        ),
      }))
      return { ok: true, value: group }
    },

    deleteGroup: async (id, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.groups.detail.actions.deleteGroup,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      const group = state.groups.find((candidate) => candidate.id === id)
      if (!group) return { ok: false, error: "group-not-found" }
      if (isSystemGroup(state.systemReferences, id)) {
        return { ok: false, error: "protected-relationship" }
      }
      const inUse =
        group.userIds.length > 0 ||
        state.accessPolicyAssignments.some(
          (assignment) =>
            assignment.targetType === "group" && assignment.targetId === id,
        )
      if (inUse) return { ok: false, error: "group-in-use" }
      updateState((current) => ({
        ...current,
        groups: current.groups.filter((candidate) => candidate.id !== id),
      }))
      return { ok: true, value: group }
    },

    assignUsersToGroups: async (userIds, groupIds) => {
      await Promise.resolve()
      const usersResult = validateIds(userIds, state.users, "user-not-found")
      if (!usersResult.ok) return usersResult
      const groupsResult = validateIds(
        groupIds,
        state.groups,
        "group-not-found",
      )
      if (!groupsResult.ok) return groupsResult
      if (
        groupsResult.ids.some((id) =>
          isSystemManagedGroup(state.systemReferences, id),
        )
      ) {
        return { ok: false, error: "protected-relationship" }
      }
      const selectedGroupIds = new Set(groupsResult.ids)
      const groups = state.groups.map((group) =>
        selectedGroupIds.has(group.id)
          ? {
              ...group,
              userIds: [
                ...group.userIds,
                ...usersResult.ids.filter(
                  (userId) => !group.userIds.includes(userId),
                ),
              ],
            }
          : group,
      )
      updateState((current) => ({ ...current, groups }))
      return {
        ok: true,
        value: groups.filter((group) => selectedGroupIds.has(group.id)),
      }
    },

    unassignUsersFromGroups: async (userIds, groupIds) => {
      await Promise.resolve()
      const usersResult = validateIds(userIds, state.users, "user-not-found")
      if (!usersResult.ok) return usersResult
      const groupsResult = validateIds(
        groupIds,
        state.groups,
        "group-not-found",
      )
      if (!groupsResult.ok) return groupsResult
      if (
        groupsResult.ids.some((id) =>
          isSystemManagedGroup(state.systemReferences, id),
        )
      ) {
        return { ok: false, error: "protected-relationship" }
      }
      const selectedUserIds = new Set(usersResult.ids)
      const selectedGroupIds = new Set(groupsResult.ids)
      const groups = state.groups.map((group) =>
        selectedGroupIds.has(group.id)
          ? {
              ...group,
              userIds: group.userIds.filter(
                (userId) => !selectedUserIds.has(userId),
              ),
            }
          : group,
      )
      updateState((current) => ({ ...current, groups }))
      return {
        ok: true,
        value: groups.filter((group) => selectedGroupIds.has(group.id)),
      }
    },

    assignUsersToRoles: async (userIds, roleIds) => {
      await Promise.resolve()
      const usersResult = validateIds(userIds, state.users, "user-not-found")
      if (!usersResult.ok) return usersResult
      const rolesResult = validateIds(roleIds, state.roles, "role-not-found")
      if (!rolesResult.ok) return rolesResult
      if (
        rolesResult.ids.some((id) =>
          isSystemManagedRole(state.systemReferences, id),
        )
      ) {
        return { ok: false, error: "protected-relationship" }
      }
      const selectedRoleIds = new Set(rolesResult.ids)
      const roles = state.roles.map((role) =>
        selectedRoleIds.has(role.id)
          ? {
              ...role,
              userIds: [
                ...role.userIds,
                ...usersResult.ids.filter(
                  (userId) => !role.userIds.includes(userId),
                ),
              ],
            }
          : role,
      )
      updateState((current) => ({ ...current, roles }))
      return {
        ok: true,
        value: roles.filter((role) => selectedRoleIds.has(role.id)),
      }
    },

    assignOrganizationsToRoles: async (organizationIds, roleIds) => {
      await Promise.resolve()
      const organizationsResult = validateIds(
        organizationIds,
        state.organizations,
        "organization-not-found",
      )
      if (!organizationsResult.ok) return organizationsResult
      const rolesResult = validateIds(roleIds, state.roles, "role-not-found")
      if (!rolesResult.ok) return rolesResult
      if (
        rolesResult.ids.some((id) =>
          isSystemManagedRole(state.systemReferences, id),
        )
      ) {
        return { ok: false, error: "protected-relationship" }
      }
      const selectedRoleIds = new Set(rolesResult.ids)
      const roles = state.roles.map((role) =>
        selectedRoleIds.has(role.id)
          ? {
              ...role,
              organizationIds: [
                ...role.organizationIds,
                ...organizationsResult.ids.filter(
                  (organizationId) =>
                    !role.organizationIds.includes(organizationId),
                ),
              ],
            }
          : role,
      )
      updateState((current) => ({ ...current, roles }))
      return {
        ok: true,
        value: roles.filter((role) => selectedRoleIds.has(role.id)),
      }
    },

    unassignUsersFromRoles: async (userIds, roleIds) => {
      await Promise.resolve()
      const usersResult = validateIds(userIds, state.users, "user-not-found")
      if (!usersResult.ok) return usersResult
      const rolesResult = validateIds(roleIds, state.roles, "role-not-found")
      if (!rolesResult.ok) return rolesResult
      if (
        rolesResult.ids.some((id) =>
          isSystemManagedRole(state.systemReferences, id),
        )
      ) {
        return { ok: false, error: "protected-relationship" }
      }
      const selectedUserIds = new Set(usersResult.ids)
      const selectedRoleIds = new Set(rolesResult.ids)
      const roles = state.roles.map((role) =>
        selectedRoleIds.has(role.id)
          ? {
              ...role,
              userIds: role.userIds.filter(
                (userId) => !selectedUserIds.has(userId),
              ),
            }
          : role,
      )
      updateState((current) => ({ ...current, roles }))
      return {
        ok: true,
        value: roles.filter((role) => selectedRoleIds.has(role.id)),
      }
    },

    unassignOrganizationsFromRoles: async (organizationIds, roleIds) => {
      await Promise.resolve()
      const organizationsResult = validateIds(
        organizationIds,
        state.organizations,
        "organization-not-found",
      )
      if (!organizationsResult.ok) return organizationsResult
      const rolesResult = validateIds(roleIds, state.roles, "role-not-found")
      if (!rolesResult.ok) return rolesResult
      if (
        rolesResult.ids.some((id) =>
          isSystemManagedRole(state.systemReferences, id),
        )
      ) {
        return { ok: false, error: "protected-relationship" }
      }
      const selectedOrganizationIds = new Set(organizationsResult.ids)
      const selectedRoleIds = new Set(rolesResult.ids)
      const roles = state.roles.map((role) =>
        selectedRoleIds.has(role.id)
          ? {
              ...role,
              organizationIds: role.organizationIds.filter(
                (organizationId) =>
                  !selectedOrganizationIds.has(organizationId),
              ),
            }
          : role,
      )
      updateState((current) => ({ ...current, roles }))
      return {
        ok: true,
        value: roles.filter((role) => selectedRoleIds.has(role.id)),
      }
    },

    setUserEmploymentStatus: async (id, status) => {
      await Promise.resolve()
      if (!employmentStatusSchema.safeParse(status).success) {
        return { ok: false, error: "invalid-input" }
      }
      const user = state.users.find((candidate) => candidate.id === id)
      if (!user) return { ok: false, error: "user-not-found" }
      if (status !== "resigned" && user.organizationIds.length === 0) {
        return { ok: false, error: "invalid-input" }
      }
      const updated = { ...user, employmentStatus: status }
      updateState((current) => ({
        ...current,
        users: current.users.map((candidate) =>
          candidate.id === id ? updated : candidate,
        ),
      }))
      return { ok: true, value: updated }
    },
  }
}
