import type { BackofficeState } from "@/application/state/model"
import type { ApprovalDocument } from "@/features/access-policies/model"
import type { ApiKey } from "@/features/credentials/model"

type CredentialOwnershipState = Pick<
  BackofficeState,
  "apiKeys" | "approvalDocuments" | "users"
>

export function resolveOwnedCredentialIds(
  state: CredentialOwnershipState,
  userId: string | null,
): readonly string[] {
  const user = state.users.find((candidate) => candidate.id === userId)
  if (user?.employmentStatus !== "employed") return []

  return state.apiKeys.flatMap((credential) => {
    if (credential.status !== "active") return []
    const issuanceDocument = state.approvalDocuments.find(
      (document) => document.id === credential.approvalDocumentId,
    )
    if (
      issuanceDocument?.documentKind !== "api-key-issuance" &&
      !(
        issuanceDocument?.documentKind === "api-key-lifecycle" &&
        issuanceDocument.type === "api-key-replace"
      )
    ) {
      throw new Error(
        `Credential issuance request not found: ${credential.approvalDocumentId}`,
      )
    }
    return issuanceDocument.requesterId === user.id ? [credential.id] : []
  })
}

export type UserCredentialHistory = Readonly<{
  requests: readonly ApprovalDocument[]
  credentials: readonly ApiKey[]
}>

export function resolveUserCredentialHistory(
  state: Pick<BackofficeState, "apiKeys" | "approvalDocuments" | "users">,
  userId: string,
): UserCredentialHistory {
  const user = state.users.find((candidate) => candidate.id === userId)
  if (!user) return { requests: [], credentials: [] }
  const requests = state.approvalDocuments
    .filter((document) => document.requesterId === user.id)
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
  const requestIds = new Set(requests.map((document) => document.id))
  const credentials = state.apiKeys
    .filter((credential) => requestIds.has(credential.approvalDocumentId))
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
  return { requests, credentials }
}
