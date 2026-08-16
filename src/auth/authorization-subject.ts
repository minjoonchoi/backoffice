import { employmentStatusValues } from "@/features/iam/model"
import type { BackofficeState } from "@/application/state/model"
import type { BackofficeUser } from "@/features/iam/model"

type AuthorizationSubjectState = Pick<BackofficeState, "roles" | "users">

export type AuthorizationSubject = Readonly<{
  user: BackofficeUser
  organizationIds: ReadonlySet<string>
  roleIds: ReadonlySet<string>
}>

export function resolveAuthorizationSubject(
  state: AuthorizationSubjectState,
  userId: string | null,
): AuthorizationSubject | null {
  if (!userId) return null
  const user = state.users.find((candidate) => candidate.id === userId)
  if (user?.employmentStatus !== employmentStatusValues.employed) return null

  const organizationIds = new Set(user.organizationIds)
  const roleIds = new Set(
    state.roles
      .filter(
        (role) =>
          role.userIds.includes(user.id) ||
          role.organizationIds.some((id) => organizationIds.has(id)),
      )
      .map((role) => role.id),
  )
  return { user, organizationIds, roleIds }
}
