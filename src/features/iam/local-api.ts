import { employmentStatusValues } from "@/features/iam/model"
import type { IamApi } from "@/features/iam/api"
import {
  hasUiResourcePolicyAccess,
  resolveUiResourcePolicyAccess,
} from "@/auth/ui-resource-policy-access"
import { uiResourceKeys } from "@/config/menu-registry"
import { entityIdListSchema } from "@/domain/common"
import {
  createRecordBase,
  type BackofficeStateUpdater,
} from "@/application/api/local-state"
import type { BackofficeState } from "@/application/state/model"
import {
  isSystemManagedRole,
  isSystemRole,
  type BackofficeSystemReferences,
} from "@/domain/system-references"
import {
  applicationInputSchema,
  employmentStatusSchema,
  organizationInputSchema,
  roleInputSchema,
  userInputSchema,
  type BackofficeUser,
  type Application,
  type Organization,
  type Role,
} from "@/features/iam/model"
import { resolveOrganizationMembershipRemovalImpact } from "@/features/iam/relationship-impact"
import { accessPolicyAssignmentTargets } from "@/features/access-policies/model"

export function synchronizeOrganizationLeaderRole(
  roles: Role[],
  organizations: Organization[],
  systemReferences: BackofficeSystemReferences,
) {
  const leaderUserIds = [
    ...new Set(organizations.map((organization) => organization.leaderUserId)),
  ]
  return roles.map((role) =>
    role.id === systemReferences.roleIds.serviceOperator
      ? { ...role, userIds: leaderUserIds }
      : role,
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
  missingError: "user-not-found" | "organization-not-found" | "role-not-found",
) {
  const parsed = entityIdListSchema.safeParse(values)
  if (!parsed.success) return { ok: false, error: "invalid-input" } as const
  if (!parsed.data.every((id) => records.some((record) => record.id === id))) {
    return { ok: false, error: missingError } as const
  }
  return { ok: true, ids: parsed.data } as const
}

function hasAnyUiResourceAccess(
  state: BackofficeState,
  requesterId: string,
  resourceKeys: readonly string[],
) {
  return resourceKeys.some((resourceKey) =>
    hasUiResourcePolicyAccess(state, requesterId, resourceKey),
  )
}

export function createLocalIamApi(
  state: BackofficeState,
  updateState: BackofficeStateUpdater,
): IamApi {
  return {
    createApplication: async (input, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.applications.list.actions.createApplication,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      const parsed = applicationInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (
        !state.organizations.some(
          (organization) => organization.id === parsed.data.ownerOrganizationId,
        )
      ) {
        return { ok: false, error: "organization-not-found" }
      }
      const normalizedName = parsed.data.name.toLocaleLowerCase()
      if (
        state.applications.some(
          (application) =>
            application.name.toLocaleLowerCase() === normalizedName ||
            application.slug === parsed.data.slug,
        )
      ) {
        return { ok: false, error: "invalid-input" }
      }
      const application: Application = {
        ...parsed.data,
        ...createRecordBase(),
      }
      updateState((current) => ({
        ...current,
        applications: [...current.applications, application],
      }))
      return { ok: true, value: application }
    },

    updateApplication: async (id, input, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.applications.detail.actions.updateApplication,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      const existing = state.applications.find(
        (application) => application.id === id,
      )
      if (!existing) return { ok: false, error: "invalid-input" }
      const parsed = applicationInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (parsed.data.slug !== existing.slug) {
        return { ok: false, error: "protected-relationship" }
      }
      if (
        !state.organizations.some(
          (organization) => organization.id === parsed.data.ownerOrganizationId,
        )
      ) {
        return { ok: false, error: "organization-not-found" }
      }
      const application: Application = {
        ...existing,
        ...parsed.data,
      }
      updateState((current) => ({
        ...current,
        applications: current.applications.map((candidate) =>
          candidate.id === id ? application : candidate,
        ),
      }))
      return { ok: true, value: application }
    },

    deleteApplication: async (id, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.applications.detail.actions.deleteApplication,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      const application = state.applications.find(
        (candidate) => candidate.id === id,
      )
      if (!application) return { ok: false, error: "invalid-input" }
      const inUse =
        state.apiKeys.some((apiKey) => apiKey.applicationId === id) ||
        state.accessPolicyAssignments.some(
          (assignment) =>
            assignment.targetType ===
              accessPolicyAssignmentTargets.application &&
            assignment.targetId === id,
        )
      if (inUse) return { ok: false, error: "protected-relationship" }
      updateState((current) => ({
        ...current,
        applications: current.applications.filter(
          (candidate) => candidate.id !== id,
        ),
      }))
      return { ok: true, value: application }
    },

    createOrganization: async (input, requesterId = "") => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.organizations.list.actions.createOrganization,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
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
      if (leader?.employmentStatus !== employmentStatusValues.employed) {
        return { ok: false, error: "user-not-found" }
      }
      const organization = { ...parsed.data, ...createRecordBase() }
      updateState((current) => ({
        ...current,
        organizations: [...current.organizations, organization],
        roles: synchronizeOrganizationLeaderRole(
          current.roles,
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

    updateOrganization: async (id, input, requesterId = "") => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.organizations.detail.actions.updateOrganization,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
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
      if (leader?.employmentStatus !== employmentStatusValues.employed) {
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
        roles: synchronizeOrganizationLeaderRole(
          current.roles,
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

    addUsersToOrganization: async (id, userIds, requesterId = "") => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.organizations.detail.actions.addOrganizationUser,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
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

    addOrganizationsToUser: async (id, organizationIds, requesterId = "") => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.users.detail.actions.assignUserOrganization,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
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

    removeUsersFromOrganizations: async (
      userIds,
      organizationIds,
      requesterId = "",
    ) => {
      await Promise.resolve()
      if (
        !hasAnyUiResourceAccess(state, requesterId, [
          uiResourceKeys.organizations.detail.actions.addOrganizationUser,
          uiResourceKeys.users.detail.actions.assignUserOrganization,
        ])
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
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
      const removesProtectedRelationship = usersResult.ids.some((userId) =>
        organizationsResult.ids.some(
          (organizationId) =>
            state.users
              .find((user) => user.id === userId)
              ?.organizationIds.includes(organizationId) &&
            resolveOrganizationMembershipRemovalImpact(
              state,
              userId,
              organizationId,
            ).blocked,
        ),
      )
      if (removesProtectedRelationship) {
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

    createUser: async (input, requesterId = "") => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.users.list.actions.createUser,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
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

    createRole: async (input, requesterId = "") => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.roles.list.actions.createRole,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
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
            assignment.targetType === accessPolicyAssignmentTargets.role &&
            assignment.targetId === id,
        ) ||
        state.namespaces.some((namespace) => namespace.managerRoleId === id)
      if (inUse) return { ok: false, error: "role-in-use" }
      updateState((current) => ({
        ...current,
        roles: current.roles.filter((candidate) => candidate.id !== id),
      }))
      return { ok: true, value: role }
    },

    assignUsersToRoles: async (userIds, roleIds, requesterId = "") => {
      await Promise.resolve()
      if (
        !hasAnyUiResourceAccess(state, requesterId, [
          uiResourceKeys.roles.detail.actions.assignRoleUser,
          uiResourceKeys.users.detail.actions.assignUserRole,
        ])
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
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

    assignOrganizationsToRoles: async (
      organizationIds,
      roleIds,
      requesterId = "",
    ) => {
      await Promise.resolve()
      if (
        !hasAnyUiResourceAccess(state, requesterId, [
          uiResourceKeys.roles.detail.actions.assignRoleOrganization,
          uiResourceKeys.organizations.detail.actions.assignOrganizationRole,
        ])
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
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

    unassignUsersFromRoles: async (userIds, roleIds, requesterId = "") => {
      await Promise.resolve()
      if (
        !hasAnyUiResourceAccess(state, requesterId, [
          uiResourceKeys.roles.detail.actions.assignRoleUser,
          uiResourceKeys.users.detail.actions.assignUserRole,
        ])
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
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

    unassignOrganizationsFromRoles: async (
      organizationIds,
      roleIds,
      requesterId = "",
    ) => {
      await Promise.resolve()
      if (
        !hasAnyUiResourceAccess(state, requesterId, [
          uiResourceKeys.roles.detail.actions.assignRoleOrganization,
          uiResourceKeys.organizations.detail.actions.assignOrganizationRole,
        ])
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
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

    setUserEmploymentStatus: async (id, status, requesterId) => {
      await Promise.resolve()
      if (
        !resolveUiResourcePolicyAccess(state, requesterId).roleIds.includes(
          state.systemReferences.roleIds.administrator,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      if (!employmentStatusSchema.safeParse(status).success) {
        return { ok: false, error: "invalid-input" }
      }
      const user = state.users.find((candidate) => candidate.id === id)
      if (!user) return { ok: false, error: "user-not-found" }
      if (
        status !== employmentStatusValues.resigned &&
        user.organizationIds.length === 0
      ) {
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
