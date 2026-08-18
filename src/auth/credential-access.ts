import type { BackofficeState } from "@/application/state/model"
import {
  approvalDocumentKinds,
  type ApprovalDocument,
} from "@/features/access-policies/model"
import { approvalTypeValues } from "@/features/request-templates/model"
import type { ApiKey } from "@/features/credentials/model"
import { resolveAuthorizationSubject } from "@/auth/authorization-subject"

type CredentialAccessState = Pick<
  BackofficeState,
  | "apiKeys"
  | "applications"
  | "approvalDocuments"
  | "roles"
  | "services"
  | "systemReferences"
  | "users"
>

export type CredentialRequest = Extract<
  ApprovalDocument,
  {
    documentKind:
      | typeof approvalDocumentKinds.apiKeyIssuance
      | typeof approvalDocumentKinds.apiKeyLifecycle
  }
>

export type CredentialIssuanceRequest = Extract<
  CredentialRequest,
  { documentKind: typeof approvalDocumentKinds.apiKeyIssuance }
>

export type CredentialScope =
  | "administrator"
  | "requester"
  | "applicationOwnerOrganization"
  | "serviceOwnerOrganization"

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
      document.documentKind === approvalDocumentKinds.apiKeyIssuance ||
      document.documentKind === approvalDocumentKinds.apiKeyLifecycle,
  )

  function resolveServiceOwnerOrganizationId(serviceId: string): string {
    const service = state.services.find((item) => item.id === serviceId)
    if (!service) throw new Error(`Credential service not found: ${serviceId}`)
    return service.ownerOrganizationId
  }

  function resolveApplicationOwnerOrganizationId(applicationId: string) {
    const application = state.applications.find(
      (item) => item.id === applicationId,
    )
    if (!application) {
      throw new Error(`Credential application not found: ${applicationId}`)
    }
    return application.ownerOrganizationId
  }

  function resolveRequestServiceId(document: CredentialRequest): string {
    if (document.documentKind === approvalDocumentKinds.apiKeyIssuance) {
      return document.serviceId
    }
    const apiKey = state.apiKeys.find((item) => item.id === document.apiKeyId)
    if (!apiKey) {
      throw new Error(`Credential not found: ${document.apiKeyId}`)
    }
    return apiKey.serviceId
  }

  function resolveRequestApplicationId(document: CredentialRequest): string {
    if (document.documentKind === approvalDocumentKinds.apiKeyIssuance) {
      return document.applicationId
    }
    const apiKey = state.apiKeys.find((item) => item.id === document.apiKeyId)
    if (!apiKey) throw new Error(`Credential not found: ${document.apiKeyId}`)
    return apiKey.applicationId
  }

  const requests = credentialRequests
    .filter((document) => {
      const ownerOrganizationId = resolveServiceOwnerOrganizationId(
        resolveRequestServiceId(document),
      )
      const applicationOwnerOrganizationId =
        resolveApplicationOwnerOrganizationId(
          resolveRequestApplicationId(document),
        )
      return (
        isAdministrator ||
        document.requesterId === subject.user.id ||
        subject.organizationIds.has(ownerOrganizationId) ||
        subject.organizationIds.has(applicationOwnerOrganizationId)
      )
    })
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))

  const credentials = state.apiKeys
    .flatMap((credential): VisibleCredential[] => {
      const document = state.approvalDocuments.find(
        (item) => item.id === credential.approvalDocumentId,
      )
      if (
        document?.documentKind !== approvalDocumentKinds.apiKeyIssuance &&
        !(
          document?.documentKind === approvalDocumentKinds.apiKeyLifecycle &&
          document.type === approvalTypeValues.apiKeyReplace
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
      const applicationOwnerOrganizationId =
        resolveApplicationOwnerOrganizationId(credential.applicationId)
      const scopes: CredentialScope[] = []
      if (isAdministrator) scopes.push("administrator")
      if (document.requesterId === subject.user.id) scopes.push("requester")
      if (subject.organizationIds.has(ownerOrganizationId)) {
        scopes.push("serviceOwnerOrganization")
      }
      if (subject.organizationIds.has(applicationOwnerOrganizationId)) {
        scopes.push("applicationOwnerOrganization")
      }
      return scopes.length > 0 ? [{ credential, scopes }] : []
    })
    .toSorted((left, right) =>
      right.credential.createdAt.localeCompare(left.credential.createdAt),
    )

  return { requests, credentials }
}
