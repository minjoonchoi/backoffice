import { resolveUiResourcePolicyAccess } from "@/auth/ui-resource-policy-access"
import { uiResourceKeys } from "@/config/menu-registry"
import type { CredentialApi } from "@/features/credentials/api"
import type { BackofficeStateUpdater } from "@/application/api/local-state"
import { createRecordBase } from "@/application/api/local-state"
import type { BackofficeState } from "@/application/state/model"
import {
  type ExternalCredentialRegistrar,
  type InternalCredentialRegistrar,
  type InternalCredentialRegistrationRequest,
} from "@/features/credentials/internal-credential-registration"
import {
  apiKeyRegistrationInputSchema,
  type ApiKey,
} from "@/features/credentials/model"

function credentialRegistrationMatches(
  response: InternalCredentialRegistrationRequest,
  request: InternalCredentialRegistrationRequest,
) {
  return (
    response.approvalDocumentId === request.approvalDocumentId &&
    response.serviceId === request.serviceId &&
    response.credentialName === request.credentialName &&
    response.awsSecretName === request.awsSecretName &&
    response.awsSecretKey === request.awsSecretKey
  )
}

export function createLocalCredentialApi(
  state: BackofficeState,
  updateState: BackofficeStateUpdater,
  internalCredentialRegistrar: InternalCredentialRegistrar,
  externalCredentialRegistrar: ExternalCredentialRegistrar,
): CredentialApi {
  return {
    registerApiKey: async (input) => {
      await Promise.resolve()
      const parsed = apiKeyRegistrationInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      const document = state.approvalDocuments.find(
        (item) => item.id === parsed.data.approvalDocumentId,
      )
      if (!document) {
        return { ok: false, error: "approval-document-not-found" }
      }
      if (
        (document.documentKind !== "api-key-issuance" &&
          !(
            document.documentKind === "api-key-lifecycle" &&
            document.type === "api-key-replace"
          )) ||
        document.status !== "approved"
      ) {
        return { ok: false, error: "approval-document-not-approved" }
      }
      if (
        state.apiKeys.some(
          (apiKey) => apiKey.approvalDocumentId === document.id,
        )
      ) {
        return { ok: false, error: "api-key-already-registered" }
      }
      const replacedApiKey =
        document.documentKind === "api-key-lifecycle"
          ? state.apiKeys.find((item) => item.id === document.apiKeyId)
          : undefined
      if (
        document.documentKind === "api-key-lifecycle" &&
        replacedApiKey?.status !== "active"
      ) {
        return { ok: false, error: "api-key-request-invalid" }
      }
      const serviceId =
        document.documentKind === "api-key-issuance"
          ? document.serviceId
          : replacedApiKey?.serviceId
      const service = state.services.find((item) => item.id === serviceId)
      if (!service) return { ok: false, error: "service-not-found" }

      const user = state.users.find(
        (item) => item.id === parsed.data.registeredByUserId,
      )
      const uiAccess = user
        ? resolveUiResourcePolicyAccess(state, user.id)
        : { roleIds: [], resourceKeys: [], grants: [] }
      const isAdministrator = uiAccess.roleIds.includes(
        state.systemReferences.roleIds.administrator,
      )
      if (
        user?.employmentStatus !== "employed" ||
        !uiAccess.resourceKeys.includes(
          uiResourceKeys.apiKeys.list.actions.registerCredential,
        ) ||
        (!isAdministrator &&
          !user.organizationIds.includes(service.ownerOrganizationId))
      ) {
        return { ok: false, error: "api-key-registration-forbidden" }
      }

      const credentialName =
        document.documentKind === "api-key-issuance"
          ? document.keyName
          : (replacedApiKey?.name ?? "")
      const endpointIds =
        document.documentKind === "api-key-issuance"
          ? document.endpointIds
          : (replacedApiKey?.endpointIds ?? [])
      const registrationRequest: InternalCredentialRegistrationRequest = {
        approvalDocumentId: document.id,
        serviceId: service.id,
        credentialName,
        awsSecretName: document.awsSecretName,
        awsSecretKey: document.awsSecretKey,
      }
      let secret: string | null
      try {
        if (service.type === "internal") {
          if (parsed.data.secret !== undefined) {
            return { ok: false, error: "invalid-input" }
          }
          const response =
            await internalCredentialRegistrar.register(registrationRequest)
          if (!credentialRegistrationMatches(response, registrationRequest)) {
            return {
              ok: false,
              error: "internal-credential-registration-failed",
            }
          }
          secret = response.secret
        } else {
          if (parsed.data.secret === undefined) {
            return { ok: false, error: "invalid-input" }
          }
          const response = await externalCredentialRegistrar.register({
            ...registrationRequest,
            secret: parsed.data.secret,
          })
          if (!credentialRegistrationMatches(response, registrationRequest)) {
            return {
              ok: false,
              error: "internal-credential-registration-failed",
            }
          }
          secret = null
        }
      } catch {
        return {
          ok: false,
          error: "internal-credential-registration-failed",
        }
      }

      const apiKey: ApiKey = {
        id: crypto.randomUUID(),
        name:
          document.documentKind === "api-key-issuance"
            ? document.keyName
            : (replacedApiKey?.name ?? ""),
        serviceId: service.id,
        endpointIds,
        approvalDocumentId: document.id,
        replacesApiKeyId: replacedApiKey?.id ?? null,
        registeredByUserId: user.id,
        awsSecretName: document.awsSecretName,
        awsSecretKey: document.awsSecretKey,
        status: "active",
        createdAt: new Date().toISOString(),
      }
      const notification = {
        userId: document.requesterId,
        targetType: "approval-document" as const,
        targetId: document.id,
        event: "api-key-issued" as const,
        readAt: null,
        ...createRecordBase(),
      }
      updateState((current) => ({
        ...current,
        apiKeys: [
          ...current.apiKeys.map((item) =>
            item.id === replacedApiKey?.id
              ? { ...item, status: "inactive" as const }
              : item,
          ),
          apiKey,
        ],
        notifications: [...current.notifications, notification],
      }))
      return {
        ok: true,
        value: {
          apiKey,
          secret,
        },
      }
    },
  }
}
