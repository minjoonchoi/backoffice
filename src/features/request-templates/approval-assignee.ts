import type { BackofficeState } from "@/application/state/model"

type ApprovalAssigneeState = Pick<BackofficeState, "organizations" | "users">

export function resolveRequestOrganizationLeader(
  state: ApprovalAssigneeState,
  organizationId: string | null | undefined,
  requesterId: string | null | undefined,
) {
  let currentOrganizationId = organizationId
  const visited = new Set<string>()

  while (currentOrganizationId) {
    if (visited.has(currentOrganizationId)) return undefined
    visited.add(currentOrganizationId)

    const organization = state.organizations.find(
      (item) => item.id === currentOrganizationId,
    )
    if (!organization) return undefined

    const leader = state.users.find(
      (user) =>
        user.id === organization.leaderUserId &&
        user.employmentStatus === "employed",
    )
    if (leader && leader.id !== requesterId) {
      return { organization, leader }
    }
    currentOrganizationId = organization.parentId
  }

  return undefined
}
