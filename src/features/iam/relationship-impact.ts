import { approvalStepStatuses } from "@/features/access-policies/model"
import { approvalDocumentStatuses } from "@/features/access-policies/model"
import { employmentStatusValues } from "@/features/iam/model"
import { resolveCredentialVisibility } from "@/auth/credential-access"
import type { BackofficeState } from "@/application/state/model"
import { approvalAssigneeTypes } from "@/features/access-policies/model"
import { resolveAssignedAccessPolicyIds } from "@/features/access-policies/access-policy-assignment"

export type OrganizationMembershipRemovalImpact = Readonly<{
  blocked: boolean
  lostRoleIds: readonly string[]
  lostPolicyIds: readonly string[]
  lostCredentialIds: readonly string[]
  affectedRequestIds: readonly string[]
}>

export function resolveOrganizationMembershipRemovalImpact(
  state: BackofficeState,
  userId: string,
  organizationId: string,
): OrganizationMembershipRemovalImpact {
  const user = state.users.find((candidate) => candidate.id === userId)
  const organization = state.organizations.find(
    (candidate) => candidate.id === organizationId,
  )
  if (
    !user ||
    !organization ||
    !user.organizationIds.includes(organizationId)
  ) {
    return {
      blocked: true,
      lostRoleIds: [],
      lostPolicyIds: [],
      lostCredentialIds: [],
      affectedRequestIds: [],
    }
  }
  const blocked =
    organization.leaderUserId === userId ||
    (user.employmentStatus !== employmentStatusValues.resigned &&
      user.organizationIds.length === 1)
  const nextState: BackofficeState = {
    ...state,
    users: state.users.map((candidate) =>
      candidate.id === userId
        ? {
            ...candidate,
            organizationIds: candidate.organizationIds.filter(
              (id) => id !== organizationId,
            ),
          }
        : candidate,
    ),
  }
  const beforePolicyIds = new Set(resolveAssignedAccessPolicyIds(state, userId))
  const afterPolicyIds = new Set(
    resolveAssignedAccessPolicyIds(nextState, userId),
  )
  const beforeCredentialIds = new Set(
    resolveCredentialVisibility(state, userId).credentials.map(
      ({ credential }) => credential.id,
    ),
  )
  const afterCredentialIds = new Set(
    resolveCredentialVisibility(nextState, userId).credentials.map(
      ({ credential }) => credential.id,
    ),
  )
  const otherEligibleOrganizationMembers = state.users.filter(
    (candidate) =>
      candidate.id !== userId &&
      candidate.employmentStatus === employmentStatusValues.employed &&
      candidate.organizationIds.includes(organizationId),
  )
  const affectedRequestIds = state.approvalDocuments
    .filter(
      (document) =>
        (document.status === approvalDocumentStatuses.draft ||
          document.status === approvalDocumentStatuses.rejected ||
          document.status === approvalDocumentStatuses.withdrawn) &&
        document.requesterId === userId &&
        document.organizationId === organizationId,
    )
    .concat(
      state.approvalDocuments.filter(
        (document) =>
          document.status === approvalDocumentStatuses.submitted &&
          otherEligibleOrganizationMembers.length === 0 &&
          document.approvalSteps.some(
            (step) =>
              step.status === approvalStepStatuses.pending &&
              step.assigneeType === approvalAssigneeTypes.organization &&
              step.assigneeId === organizationId,
          ),
      ),
    )
    .map((document) => document.id)

  return {
    blocked: blocked || affectedRequestIds.length > 0,
    lostRoleIds: state.roles
      .filter((role) => role.organizationIds.includes(organizationId))
      .filter(
        (role) =>
          !role.userIds.includes(userId) &&
          !role.organizationIds.some(
            (id) => id !== organizationId && user.organizationIds.includes(id),
          ),
      )
      .map((role) => role.id),
    lostPolicyIds: [...beforePolicyIds].filter((id) => !afterPolicyIds.has(id)),
    lostCredentialIds: [...beforeCredentialIds].filter(
      (id) => !afterCredentialIds.has(id),
    ),
    affectedRequestIds: [...new Set(affectedRequestIds)],
  }
}
