import type { BackofficeUser } from "@/features/iam/model"

export function resolveVisibleDirectoryUsers(
  users: readonly BackofficeUser[],
  canViewDirectory: boolean,
): BackofficeUser[] {
  if (canViewDirectory) return [...users]
  return users.filter((user) => user.employmentStatus !== "resigned")
}
