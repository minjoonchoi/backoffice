import { employmentStatusValues } from "@/features/iam/model"
import type { BackofficeUser } from "@/features/iam/model"

export function resolveVisibleDirectoryUsers(
  users: readonly BackofficeUser[],
  includeResignedUsers: boolean,
): BackofficeUser[] {
  if (includeResignedUsers) return [...users]
  return users.filter(
    (user) => user.employmentStatus !== employmentStatusValues.resigned,
  )
}
