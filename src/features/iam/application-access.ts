import type { BackofficeState } from "@/application/state/model"
import { resolveAuthorizationSubject } from "@/auth/authorization-subject"
import { entityStatuses } from "@/domain/common"
import { accessPolicyAssignmentTargets } from "@/features/access-policies/model"
import type { Application, Organization } from "@/features/iam/model"

type ApplicationAccessState = Pick<
  BackofficeState,
  "applications" | "organizations" | "roles" | "systemReferences" | "users"
>

type ApplicationRelationshipState = Pick<
  BackofficeState,
  "accessPolicyAssignments" | "apiKeys"
>

export type ApplicationResourceAccess = Readonly<{
  applications: readonly Application[]
  ownerOrganizations: readonly Organization[]
}>

const noApplicationResourceAccess: ApplicationResourceAccess = Object.freeze({
  applications: Object.freeze([]),
  ownerOrganizations: Object.freeze([]),
})

export const applicationDeletionBlockers = {
  activeCredential: "active-credential",
  credentialHistory: "credential-history",
  policyAssignment: "policy-assignment",
} as const

export type ApplicationDeletionBlocker =
  (typeof applicationDeletionBlockers)[keyof typeof applicationDeletionBlockers]

export function resolveApplicationResourceAccess(
  state: ApplicationAccessState,
  userId: string | null,
): ApplicationResourceAccess {
  const subject = resolveAuthorizationSubject(state, userId)
  if (!subject) return noApplicationResourceAccess

  const canManageAllOrganizations = [
    state.systemReferences.roleIds.administrator,
    state.systemReferences.roleIds.iamOperator,
  ].some((roleId) => subject.roleIds.has(roleId))

  const ownerOrganizations = canManageAllOrganizations
    ? state.organizations
    : state.organizations.filter((organization) =>
        subject.organizationIds.has(organization.id),
      )
  const ownerOrganizationIds = new Set(
    ownerOrganizations.map((organization) => organization.id),
  )

  return {
    ownerOrganizations,
    applications: state.applications.filter((application) =>
      ownerOrganizationIds.has(application.ownerOrganizationId),
    ),
  }
}

export function resolveApplicationDeletionBlocker(
  state: ApplicationRelationshipState,
  applicationId: string,
): ApplicationDeletionBlocker | null {
  const credentials = state.apiKeys.filter(
    (credential) => credential.applicationId === applicationId,
  )
  if (
    credentials.some(
      (credential) => credential.status === entityStatuses.active,
    )
  ) {
    return applicationDeletionBlockers.activeCredential
  }
  if (credentials.length > 0) {
    return applicationDeletionBlockers.credentialHistory
  }
  if (
    state.accessPolicyAssignments.some(
      (assignment) =>
        assignment.targetType === accessPolicyAssignmentTargets.application &&
        assignment.targetId === applicationId,
    )
  ) {
    return applicationDeletionBlockers.policyAssignment
  }
  return null
}
