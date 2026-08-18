import { approvalDocumentStatuses } from "@/features/access-policies/model"
import { approvalTypeValues } from "@/features/request-templates/model"
import { approvalDocumentKinds } from "@/features/access-policies/model"
import { serviceTypeValues } from "@/features/service-catalog/model"
import { employmentStatusValues } from "@/features/iam/model"
import { entityStatuses } from "@/domain/common"
import { resolveUiResourcePolicyAccess } from "@/auth/ui-resource-policy-access"
import { uiResourceKeys } from "@/config/menu-registry"
import type { CredentialApi } from "@/features/credentials/api"
import type { BackofficeStateUpdater } from "@/application/api/local-state"
import { createRecordBase } from "@/application/api/local-state"
import type { BackofficeState } from "@/application/state/model"
import {
  userNotificationEventValues,
  userNotificationTargetTypeValues,
} from "@/application/state/model"
import type {
  AccessPolicy,
  AccessPolicyAssignment,
} from "@/features/access-policies/model"
import {
  accessPolicyAssignmentTargets,
  accessPolicyEffects,
  accessPolicyManagementTypes,
  accessPolicyResourceTypes,
} from "@/features/access-policies/model"
import {
  type ExternalCredentialRegistrar,
  type InternalCredentialRegistrar,
  type InternalCredentialRegistrationRequest,
} from "@/features/credentials/internal-credential-registration"
import {
  apiKeyEmergencyRevokeInputSchema,
  apiKeyRegistrationInputSchema,
  credentialLifecycleSettingsInputSchema,
  type ApiKey,
} from "@/features/credentials/model"

function addDays(value: string, days: number) {
  const date = new Date(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

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
  function canManageCredential(apiKey: ApiKey, requesterId: string) {
    const service = state.services.find((item) => item.id === apiKey.serviceId)
    const user = state.users.find((item) => item.id === requesterId)
    if (!service || user?.employmentStatus !== employmentStatusValues.employed)
      return false
    const uiAccess = resolveUiResourcePolicyAccess(state, requesterId)
    const isAdministrator = uiAccess.roleIds.includes(
      state.systemReferences.roleIds.administrator,
    )
    return (
      isAdministrator ||
      user.organizationIds.includes(service.ownerOrganizationId)
    )
  }

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
        (document.documentKind !== approvalDocumentKinds.apiKeyIssuance &&
          !(
            document.documentKind === approvalDocumentKinds.apiKeyLifecycle &&
            document.type === approvalTypeValues.apiKeyReplace
          )) ||
        document.status !== approvalDocumentStatuses.approved
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
        document.documentKind === approvalDocumentKinds.apiKeyLifecycle
          ? state.apiKeys.find((item) => item.id === document.apiKeyId)
          : undefined
      if (
        document.documentKind === approvalDocumentKinds.apiKeyLifecycle &&
        replacedApiKey?.status !== entityStatuses.active
      ) {
        return { ok: false, error: "api-key-request-invalid" }
      }
      const serviceId =
        document.documentKind === approvalDocumentKinds.apiKeyIssuance
          ? document.serviceId
          : replacedApiKey?.serviceId
      const service = state.services.find((item) => item.id === serviceId)
      if (!service) return { ok: false, error: "service-not-found" }
      const applicationId =
        document.documentKind === approvalDocumentKinds.apiKeyIssuance
          ? document.applicationId
          : replacedApiKey?.applicationId
      const application = state.applications.find(
        (candidate) => candidate.id === applicationId,
      )
      if (!application) return { ok: false, error: "invalid-input" }

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
        user?.employmentStatus !== employmentStatusValues.employed ||
        !uiAccess.resourceKeys.includes(
          uiResourceKeys.apiKeys.list.actions.registerCredential,
        ) ||
        (!isAdministrator &&
          !user.organizationIds.includes(service.ownerOrganizationId))
      ) {
        return { ok: false, error: "api-key-registration-forbidden" }
      }

      const credentialName =
        document.documentKind === approvalDocumentKinds.apiKeyIssuance
          ? document.keyName
          : (replacedApiKey?.name ?? "")
      const endpointIds =
        document.documentKind === approvalDocumentKinds.apiKeyIssuance
          ? document.endpointIds
          : (replacedApiKey?.endpointIds ?? [])
      const endpointIdsValid = endpointIds.every((endpointId) =>
        state.serviceEndpoints.some(
          (endpoint) =>
            endpoint.id === endpointId && endpoint.serviceId === service.id,
        ),
      )
      if (
        !endpointIdsValid ||
        (service.type === serviceTypeValues.internal &&
          endpointIds.length === 0) ||
        (service.type === serviceTypeValues.external && endpointIds.length > 0)
      ) {
        return { ok: false, error: "api-key-request-invalid" }
      }
      const registrationRequest: InternalCredentialRegistrationRequest = {
        approvalDocumentId: document.id,
        serviceId: service.id,
        credentialName,
        awsSecretName: document.awsSecretName,
        awsSecretKey: document.awsSecretKey,
      }
      let secret: string | null
      try {
        if (service.type === serviceTypeValues.internal) {
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

      const createdAt = new Date().toISOString()
      const accessPolicyId =
        replacedApiKey?.accessPolicyId ??
        (endpointIds.length > 0 ? crypto.randomUUID() : null)
      const accessPolicy: AccessPolicy | null =
        replacedApiKey || accessPolicyId === null
          ? null
          : {
              id: accessPolicyId,
              name: `${application.name} · ${service.name} 접근`,
              description: `${application.name} 자격증명이 ${service.name}에서 선택한 리소스에 접근하도록 시스템에서 관리합니다.`,
              type: approvalTypeValues.accessGrant,
              managementType: accessPolicyManagementTypes.system,
              effect: accessPolicyEffects.allow,
              resources: endpointIds.map((id) => ({
                type: accessPolicyResourceTypes.endpoint,
                id,
              })),
              status: entityStatuses.active,
              createdAt,
            }
      const accessPolicyAssignment: AccessPolicyAssignment | null =
        replacedApiKey || accessPolicyId === null
          ? null
          : {
              id: crypto.randomUUID(),
              accessPolicyId,
              targetType: accessPolicyAssignmentTargets.application,
              targetId: application.id,
              expiresAt: null,
              createdAt,
            }
      const apiKey: ApiKey = {
        id: crypto.randomUUID(),
        name:
          document.documentKind === approvalDocumentKinds.apiKeyIssuance
            ? document.keyName
            : (replacedApiKey?.name ?? ""),
        applicationId: application.id,
        accessPolicyId,
        serviceId: service.id,
        endpointIds,
        approvalDocumentId: document.id,
        replacesApiKeyId: replacedApiKey?.id ?? null,
        registeredByUserId: user.id,
        awsSecretName: document.awsSecretName,
        awsSecretKey: document.awsSecretKey,
        expiresAt: addDays(
          createdAt,
          state.credentialLifecycleSettings.expirationPeriodDays,
        ),
        nextRotationAt: addDays(
          createdAt,
          state.credentialLifecycleSettings.rotationIntervalDays,
        ),
        usageSystemNames: [],
        emergencyRevokedAt: null,
        emergencyRevokeReason: null,
        status: entityStatuses.active,
        createdAt,
      }
      const notification = {
        userId: document.requesterId,
        targetType: userNotificationTargetTypeValues.approvalDocument,
        targetId: document.id,
        event: userNotificationEventValues.apiKeyIssued,
        readAt: null,
        ...createRecordBase(),
      }
      updateState((current) => ({
        ...current,
        accessPolicies: accessPolicy
          ? [...current.accessPolicies, accessPolicy]
          : current.accessPolicies,
        accessPolicyAssignments: accessPolicyAssignment
          ? [...current.accessPolicyAssignments, accessPolicyAssignment]
          : current.accessPolicyAssignments,
        apiKeys: [
          ...current.apiKeys.map((item) =>
            item.id === replacedApiKey?.id
              ? { ...item, status: entityStatuses.inactive }
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

    updateCredentialLifecycleSettings: async (input, requesterId) => {
      await Promise.resolve()
      const user = state.users.find((item) => item.id === requesterId)
      const canUpdate = resolveUiResourcePolicyAccess(
        state,
        requesterId,
      ).resourceKeys.includes(
        uiResourceKeys.apiKeys.lifecycleSettings.actions
          .updateLifecycleSettings,
      )
      if (
        user?.employmentStatus !== employmentStatusValues.employed ||
        !canUpdate
      ) {
        return { ok: false, error: "api-key-registration-forbidden" }
      }
      const parsed = credentialLifecycleSettingsInputSchema.safeParse(input)
      if (!parsed.success) {
        return { ok: false, error: "invalid-input" }
      }
      const settings = {
        ...parsed.data,
        updatedAt: new Date().toISOString(),
        updatedByUserId: requesterId,
      }
      updateState((current) => ({
        ...current,
        credentialLifecycleSettings: settings,
        apiKeys: current.apiKeys.map((item) =>
          item.status === entityStatuses.active
            ? {
                ...item,
                expiresAt: addDays(
                  item.createdAt,
                  settings.expirationPeriodDays,
                ),
                nextRotationAt: addDays(
                  item.createdAt,
                  settings.rotationIntervalDays,
                ),
              }
            : item,
        ),
      }))
      return { ok: true, value: settings }
    },

    emergencyRevokeApiKey: async (input) => {
      await Promise.resolve()
      const parsed = apiKeyEmergencyRevokeInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      const existing = state.apiKeys.find(
        (apiKey) => apiKey.id === parsed.data.apiKeyId,
      )
      if (!existing) return { ok: false, error: "api-key-request-invalid" }
      if (
        !resolveUiResourcePolicyAccess(
          state,
          parsed.data.requesterId,
        ).resourceKeys.includes(
          uiResourceKeys.apiKeys.detail.actions.emergencyRevokeCredential,
        ) ||
        !canManageCredential(existing, parsed.data.requesterId)
      ) {
        return { ok: false, error: "api-key-registration-forbidden" }
      }
      if (existing.status !== entityStatuses.active) {
        return { ok: false, error: "api-key-request-invalid" }
      }
      const emergencyRevokedAt = new Date().toISOString()
      const apiKey: ApiKey = {
        ...existing,
        status: entityStatuses.inactive,
        nextRotationAt: null,
        emergencyRevokedAt,
        emergencyRevokeReason: parsed.data.reason,
      }
      const document = state.approvalDocuments.find(
        (item) => item.id === existing.approvalDocumentId,
      )
      updateState((current) => ({
        ...current,
        apiKeys: current.apiKeys.map((item) =>
          item.id === existing.id ? apiKey : item,
        ),
        accessPolicies: current.accessPolicies.map((policy) =>
          existing.accessPolicyId !== null &&
          policy.id === existing.accessPolicyId
            ? { ...policy, status: entityStatuses.inactive }
            : policy,
        ),
        notifications: document
          ? [
              ...current.notifications,
              {
                userId: document.requesterId,
                targetType: userNotificationTargetTypeValues.approvalDocument,
                targetId: document.id,
                event: userNotificationEventValues.apiKeyEmergencyRevoked,
                readAt: null,
                ...createRecordBase(),
              },
            ]
          : current.notifications,
      }))
      return { ok: true, value: apiKey }
    },
  }
}
