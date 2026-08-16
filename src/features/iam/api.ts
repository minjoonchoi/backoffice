import type { CommandResult } from "@/domain/common"
import type {
  Application,
  ApplicationInput,
  BackofficeUser,
  EmploymentStatus,
  Organization,
  OrganizationInput,
  Role,
  RoleInput,
  UserInput,
} from "@/features/iam/model"

export interface IamApi {
  createApplication: (
    input: ApplicationInput,
    requesterId: string,
  ) => Promise<CommandResult<Application>>
  updateApplication: (
    id: string,
    input: ApplicationInput,
    requesterId: string,
  ) => Promise<CommandResult<Application>>
  deleteApplication: (
    id: string,
    requesterId: string,
  ) => Promise<CommandResult<Application>>
  createOrganization: (
    input: OrganizationInput,
    requesterId?: string,
  ) => Promise<CommandResult<Organization>>
  updateOrganization: (
    id: string,
    input: OrganizationInput,
    requesterId?: string,
  ) => Promise<CommandResult<Organization>>
  addUsersToOrganization: (
    id: string,
    userIds: string[],
    requesterId?: string,
  ) => Promise<CommandResult<BackofficeUser[]>>
  addOrganizationsToUser: (
    id: string,
    organizationIds: string[],
    requesterId?: string,
  ) => Promise<CommandResult<BackofficeUser>>
  removeUsersFromOrganizations: (
    userIds: string[],
    organizationIds: string[],
    requesterId?: string,
  ) => Promise<CommandResult<BackofficeUser[]>>
  createUser: (
    input: UserInput,
    requesterId?: string,
  ) => Promise<CommandResult<BackofficeUser>>
  createRole: (
    input: RoleInput,
    requesterId?: string,
  ) => Promise<CommandResult<Role>>
  updateRole: (
    id: string,
    input: RoleInput,
    requesterId: string,
  ) => Promise<CommandResult<Role>>
  deleteRole: (id: string, requesterId: string) => Promise<CommandResult<Role>>
  assignUsersToRoles: (
    userIds: string[],
    roleIds: string[],
    requesterId?: string,
  ) => Promise<CommandResult<Role[]>>
  assignOrganizationsToRoles: (
    organizationIds: string[],
    roleIds: string[],
    requesterId?: string,
  ) => Promise<CommandResult<Role[]>>
  unassignUsersFromRoles: (
    userIds: string[],
    roleIds: string[],
    requesterId?: string,
  ) => Promise<CommandResult<Role[]>>
  unassignOrganizationsFromRoles: (
    organizationIds: string[],
    roleIds: string[],
    requesterId?: string,
  ) => Promise<CommandResult<Role[]>>
  setUserEmploymentStatus: (
    id: string,
    status: EmploymentStatus,
    requesterId: string,
  ) => Promise<CommandResult<BackofficeUser>>
}

export interface IamApiClient {
  createApplication: (request: {
    body: ApplicationInput
    requesterId: string
  }) => Promise<CommandResult<Application>>
  updateApplication: (request: {
    applicationId: string
    body: ApplicationInput
    requesterId: string
  }) => Promise<CommandResult<Application>>
  deleteApplication: (request: {
    applicationId: string
    requesterId: string
  }) => Promise<CommandResult<Application>>
  createOrganization: (request: {
    body: OrganizationInput
    requesterId: string
  }) => Promise<CommandResult<Organization>>
  updateOrganization: (request: {
    id: string
    body: OrganizationInput
    requesterId: string
  }) => Promise<CommandResult<Organization>>
  addUsersToOrganization: (request: {
    organizationId: string
    userIds: string[]
    requesterId: string
  }) => Promise<CommandResult<BackofficeUser[]>>
  addOrganizationsToUser: (request: {
    userId: string
    organizationIds: string[]
    requesterId: string
  }) => Promise<CommandResult<BackofficeUser>>
  removeUsersFromOrganizations: (request: {
    userIds: string[]
    organizationIds: string[]
    requesterId: string
  }) => Promise<CommandResult<BackofficeUser[]>>
  createUser: (request: {
    body: UserInput
    requesterId: string
  }) => Promise<CommandResult<BackofficeUser>>
  createRole: (request: {
    body: RoleInput
    requesterId: string
  }) => Promise<CommandResult<Role>>
  updateRole: (request: {
    roleId: string
    body: RoleInput
    requesterId: string
  }) => Promise<CommandResult<Role>>
  deleteRole: (request: {
    roleId: string
    requesterId: string
  }) => Promise<CommandResult<Role>>
  assignUsersToRoles: (request: {
    userIds: string[]
    roleIds: string[]
    requesterId: string
  }) => Promise<CommandResult<Role[]>>
  assignOrganizationsToRoles: (request: {
    organizationIds: string[]
    roleIds: string[]
    requesterId: string
  }) => Promise<CommandResult<Role[]>>
  unassignUsersFromRoles: (request: {
    userIds: string[]
    roleIds: string[]
    requesterId: string
  }) => Promise<CommandResult<Role[]>>
  unassignOrganizationsFromRoles: (request: {
    organizationIds: string[]
    roleIds: string[]
    requesterId: string
  }) => Promise<CommandResult<Role[]>>
  setUserEmploymentStatus: (request: {
    userId: string
    status: EmploymentStatus
    requesterId: string
  }) => Promise<CommandResult<BackofficeUser>>
}
