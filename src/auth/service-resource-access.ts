import type { BackofficeState } from "@/application/state/model"
import type { ManagedService } from "@/features/service-catalog/model"
import { resolveAuthorizationSubject } from "@/auth/authorization-subject"

type ServiceResourceAccessState = Pick<
  BackofficeState,
  "organizations" | "roles" | "systemReferences" | "users"
>

export type ServiceResourceAccess = Readonly<{
  isAdministrator: boolean
  isOrganizationLeader: boolean
  manageableOrganizationIds: readonly string[]
}>

const noServiceResourceAccess: ServiceResourceAccess = Object.freeze({
  isAdministrator: false,
  isOrganizationLeader: false,
  manageableOrganizationIds: Object.freeze([]),
})

export function resolveServiceResourceAccess(
  state: ServiceResourceAccessState,
  userId: string | null,
): ServiceResourceAccess {
  const subject = resolveAuthorizationSubject(state, userId)
  if (!subject) return noServiceResourceAccess

  const isAdministrator = subject.roleIds.has(
    state.systemReferences.roleIds.administrator,
  )
  const isOrganizationLeader = subject.roleIds.has(
    state.systemReferences.roleIds.serviceOperator,
  )
  const manageableOrganizationIds = isAdministrator
    ? state.organizations.map((organization) => organization.id)
    : isOrganizationLeader
      ? state.organizations
          .filter(
            (organization) => organization.leaderUserId === subject.user.id,
          )
          .map((organization) => organization.id)
      : []

  return {
    isAdministrator,
    isOrganizationLeader,
    manageableOrganizationIds,
  }
}

export function canManageService(
  access: ServiceResourceAccess,
  service: ManagedService,
) {
  return access.manageableOrganizationIds.includes(service.ownerOrganizationId)
}
