import type { CommandResult } from "@/domain/common"
import type {
  BackofficeUser,
  EmploymentStatus,
  Group,
  GroupInput,
  Organization,
  OrganizationInput,
  Role,
  RoleInput,
  UserInput,
} from "@/features/iam/model"

export interface IamApi {
  createOrganization: (
    input: OrganizationInput,
  ) => Promise<CommandResult<Organization>>
  updateOrganization: (
    id: string,
    input: OrganizationInput,
  ) => Promise<CommandResult<Organization>>
  addUsersToOrganization: (
    id: string,
    userIds: string[],
  ) => Promise<CommandResult<BackofficeUser[]>>
  addOrganizationsToUser: (
    id: string,
    organizationIds: string[],
  ) => Promise<CommandResult<BackofficeUser>>
  removeUsersFromOrganizations: (
    userIds: string[],
    organizationIds: string[],
  ) => Promise<CommandResult<BackofficeUser[]>>
  createUser: (input: UserInput) => Promise<CommandResult<BackofficeUser>>
  createRole: (input: RoleInput) => Promise<CommandResult<Role>>
  updateRole: (
    id: string,
    input: RoleInput,
    requesterId: string,
  ) => Promise<CommandResult<Role>>
  deleteRole: (id: string, requesterId: string) => Promise<CommandResult<Role>>
  createGroup: (input: GroupInput) => Promise<CommandResult<Group>>
  updateGroup: (
    id: string,
    input: GroupInput,
    requesterId: string,
  ) => Promise<CommandResult<Group>>
  deleteGroup: (
    id: string,
    requesterId: string,
  ) => Promise<CommandResult<Group>>
  assignUsersToGroups: (
    userIds: string[],
    groupIds: string[],
  ) => Promise<CommandResult<Group[]>>
  unassignUsersFromGroups: (
    userIds: string[],
    groupIds: string[],
  ) => Promise<CommandResult<Group[]>>
  assignUsersToRoles: (
    userIds: string[],
    roleIds: string[],
  ) => Promise<CommandResult<Role[]>>
  assignOrganizationsToRoles: (
    organizationIds: string[],
    roleIds: string[],
  ) => Promise<CommandResult<Role[]>>
  unassignUsersFromRoles: (
    userIds: string[],
    roleIds: string[],
  ) => Promise<CommandResult<Role[]>>
  unassignOrganizationsFromRoles: (
    organizationIds: string[],
    roleIds: string[],
  ) => Promise<CommandResult<Role[]>>
  setUserEmploymentStatus: (
    id: string,
    status: EmploymentStatus,
  ) => Promise<CommandResult<BackofficeUser>>
}

export interface IamApiClient {
  createOrganization: (request: {
    body: OrganizationInput
  }) => Promise<CommandResult<Organization>>
  updateOrganization: (request: {
    id: string
    body: OrganizationInput
  }) => Promise<CommandResult<Organization>>
  addUsersToOrganization: (request: {
    organizationId: string
    userIds: string[]
  }) => Promise<CommandResult<BackofficeUser[]>>
  addOrganizationsToUser: (request: {
    userId: string
    organizationIds: string[]
  }) => Promise<CommandResult<BackofficeUser>>
  removeUsersFromOrganizations: (request: {
    userIds: string[]
    organizationIds: string[]
  }) => Promise<CommandResult<BackofficeUser[]>>
  createUser: (request: {
    body: UserInput
  }) => Promise<CommandResult<BackofficeUser>>
  createRole: (request: { body: RoleInput }) => Promise<CommandResult<Role>>
  updateRole: (request: {
    roleId: string
    body: RoleInput
    requesterId: string
  }) => Promise<CommandResult<Role>>
  deleteRole: (request: {
    roleId: string
    requesterId: string
  }) => Promise<CommandResult<Role>>
  createGroup: (request: { body: GroupInput }) => Promise<CommandResult<Group>>
  updateGroup: (request: {
    groupId: string
    body: GroupInput
    requesterId: string
  }) => Promise<CommandResult<Group>>
  deleteGroup: (request: {
    groupId: string
    requesterId: string
  }) => Promise<CommandResult<Group>>
  assignUsersToGroups: (request: {
    userIds: string[]
    groupIds: string[]
  }) => Promise<CommandResult<Group[]>>
  unassignUsersFromGroups: (request: {
    userIds: string[]
    groupIds: string[]
  }) => Promise<CommandResult<Group[]>>
  assignUsersToRoles: (request: {
    userIds: string[]
    roleIds: string[]
  }) => Promise<CommandResult<Role[]>>
  assignOrganizationsToRoles: (request: {
    organizationIds: string[]
    roleIds: string[]
  }) => Promise<CommandResult<Role[]>>
  unassignUsersFromRoles: (request: {
    userIds: string[]
    roleIds: string[]
  }) => Promise<CommandResult<Role[]>>
  unassignOrganizationsFromRoles: (request: {
    organizationIds: string[]
    roleIds: string[]
  }) => Promise<CommandResult<Role[]>>
  setUserEmploymentStatus: (request: {
    userId: string
    status: EmploymentStatus
  }) => Promise<CommandResult<BackofficeUser>>
}
