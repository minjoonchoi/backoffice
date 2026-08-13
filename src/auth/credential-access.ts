import type { BackofficeState } from "@/application/state/model"
import type { ApprovalDocument } from "@/features/access-policies/model"
import type { ApiKey } from "@/features/credentials/model"
import { resolveAuthorizationSubject } from "@/auth/authorization-subject"

type CredentialAccessState = Pick<
  BackofficeState,
  | "apiKeys"
  | "approvalDocuments"
  | "groups"
  | "roles"
  | "services"
  | "systemReferences"
  | "users"
>

export type CredentialRequest = Extract<
  ApprovalDocument,
  { documentKind: "api-key-issuance" | "api-key-lifecycle" }
>

export type CredentialIssuanceRequest = Extract<
  CredentialRequest,
  { documentKind: "api-key-issuance" }
>

export type CredentialScope =
  "administrator" | "requester" | "ownerOrganization"

export type VisibleCredential = Readonly<{
  credential: ApiKey
  scopes: readonly CredentialScope[]
}>

export type CredentialVisibility = Readonly<{
  requests: CredentialRequest[]
  credentials: VisibleCredential[]
}>

const noCredentialRequests: CredentialRequest[] = []
const noCredentials: VisibleCredential[] = []
const noCredentialVisibility: CredentialVisibility = Object.freeze({
  requests: noCredentialRequests,
  credentials: noCredentials,
})

export function resolveCredentialVisibility(
  state: CredentialAccessState,
  userId: string | null,
): CredentialVisibility {
  const subject = resolveAuthorizationSubject(state, userId)
  if (!subject) return noCredentialVisibility
  const isAdministrator = subject.roleIds.has(
    state.systemReferences.roleIds.administrator,
  )
  const credentialRequests = state.approvalDocuments.filter(
    (document): document is CredentialRequest =>
      document.documentKind === "api-key-issuance" ||
      document.documentKind === "api-key-lifecycle",
  )

  function resolveServiceOwnerOrganizationId(serviceId: string): string {
    const service = state.services.find((item) => item.id === serviceId)
    if (!service) throw new Error(`Credential service not found: ${serviceId}`)
    return service.ownerOrganizationId
  }

  function resolveRequestServiceId(document: CredentialRequest): string {
    if (document.documentKind === "api-key-issuance") {
      return document.serviceId
    }
    const apiKey = state.apiKeys.find((item) => item.id === document.apiKeyId)
    if (!apiKey) {
      throw new Error(`Credential not found: ${document.apiKeyId}`)
    }
    return apiKey.serviceId
  }

  const requests = credentialRequests
    .filter((document) => {
      const ownerOrganizationId = resolveServiceOwnerOrganizationId(
        resolveRequestServiceId(document),
      )
      return (
        isAdministrator ||
        document.requesterId === subject.user.id ||
        subject.organizationIds.has(ownerOrganizationId)
      )
    })
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))

  const credentials = state.apiKeys
    .flatMap((credential): VisibleCredential[] => {
      const document = state.approvalDocuments.find(
        (item) => item.id === credential.approvalDocumentId,
      )
      if (
        document?.documentKind !== "api-key-issuance" &&
        !(
          document?.documentKind === "api-key-lifecycle" &&
          document.type === "api-key-replace"
        )
      ) {
        throw new Error(
          `Credential issuance request not found: ${credential.approvalDocumentId}`,
        )
      }
      if (resolveRequestServiceId(document) !== credential.serviceId) {
        throw new Error(`Credential service mismatch: ${credential.id}`)
      }
      const ownerOrganizationId = resolveServiceOwnerOrganizationId(
        credential.serviceId,
      )
      const scopes: CredentialScope[] = []
      if (isAdministrator) scopes.push("administrator")
      if (document.requesterId === subject.user.id) scopes.push("requester")
      if (subject.organizationIds.has(ownerOrganizationId)) {
        scopes.push("ownerOrganization")
      }
      return scopes.length > 0 ? [{ credential, scopes }] : []
    })
    .toSorted((left, right) =>
      right.credential.createdAt.localeCompare(left.credential.createdAt),
    )

  return { requests, credentials }
}
