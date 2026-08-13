import { hasEffectiveAccessPolicy } from "@/features/access-policies/access-policy-assignment"
import {
  approvalDocumentInputSchema,
  type AccessPolicyAssignment,
  type ApprovalDocument,
} from "@/features/access-policies/model"
import type { ApprovalDocumentApi } from "@/features/access-policies/api"
import type { BackofficeStateUpdater } from "@/application/api/local-state"
import { createRecordBase } from "@/application/api/local-state"
import type {
  BackofficeState,
  UserNotification,
  UserNotificationEvent,
  UserNotificationTargetType,
} from "@/application/state/model"
import { resolveOwnedCredentialIds } from "@/features/credentials/credential-ownership"
import type { ResolvedApprovalStep } from "@/features/request-templates/model"
import { resolveRequestOrganizationLeader } from "@/features/request-templates/approval-assignee"

function createUserNotification(
  userId: string,
  targetType: UserNotificationTargetType,
  targetId: string,
  event: UserNotificationEvent,
): UserNotification {
  return {
    userId,
    targetType,
    targetId,
    event,
    readAt: null,
    ...createRecordBase(),
  }
}

function approvalCompletionEvent(
  document: ApprovalDocument,
): UserNotificationEvent {
  switch (document.type) {
    case "resource-create":
      return "resource-created"
    case "access-grant":
      return "access-granted"
    case "access-revoke":
      return "access-revoked"
    case "resource-dispose":
      return "resource-disposed"
    case "api-key":
      return "api-key-issued"
    case "api-key-replace":
      return "api-key-replacement-approved"
    case "api-key-dispose":
      return "api-key-disposal-approved"
  }
}

export function createLocalApprovalDocumentApi(
  state: BackofficeState,
  updateState: BackofficeStateUpdater,
): ApprovalDocumentApi {
  return {
    createApprovalDocument: async (input) => {
      await Promise.resolve()
      const parsed = approvalDocumentInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      const line = state.approvalLines.find(
        (item) => item.id === parsed.data.approvalLineId,
      )
      if (line?.status !== "active") {
        return { ok: false, error: "approval-line-not-found" }
      }
      const requester = state.users.find(
        (user) => user.id === parsed.data.requesterId,
      )
      const requestOrganization = state.organizations.find(
        (organization) => organization.id === parsed.data.organizationId,
      )
      if (
        requester?.employmentStatus !== "employed" ||
        !requestOrganization ||
        !requester.organizationIds.includes(requestOrganization.id)
      ) {
        return { ok: false, error: "user-not-found" }
      }
      if (
        line.type !== parsed.data.type ||
        (line.category === "credential") !==
          parsed.data.type.startsWith("api-key")
      ) {
        return { ok: false, error: "approval-reference-mismatch" }
      }
      const accessPolicyId =
        parsed.data.documentKind === "general" &&
        parsed.data.type === "access-grant"
          ? parsed.data.accessPolicyId
          : null
      const accessPolicy = state.accessPolicies.find(
        (policy) => policy.id === accessPolicyId,
      )
      if (
        parsed.data.documentKind === "general" &&
        parsed.data.type === "access-grant" &&
        (accessPolicy?.status !== "active" || accessPolicy.type !== line.type)
      ) {
        return { ok: false, error: "approval-reference-mismatch" }
      }
      if (
        accessPolicyId !== null &&
        accessPolicy &&
        hasEffectiveAccessPolicy(state, requester.id, accessPolicy)
      ) {
        return { ok: false, error: "access-policy-already-assigned" }
      }
      const customFields = line.fields.filter(
        (field) => field.binding === "custom",
      )
      const fieldValuesMatch =
        parsed.data.fieldValues.every((value) =>
          customFields.some((field) => field.id === value.fieldId),
        ) &&
        customFields.every(
          (field) =>
            !field.required ||
            parsed.data.fieldValues.some(
              (value) =>
                value.fieldId === field.id && value.value.trim().length > 0,
            ),
        )
      if (!fieldValuesMatch) {
        return { ok: false, error: "invalid-input" }
      }
      const lifecycleApiKeyId =
        parsed.data.documentKind === "api-key-lifecycle"
          ? parsed.data.apiKeyId
          : null
      const lifecycleApiKey =
        lifecycleApiKeyId !== null
          ? state.apiKeys.find((apiKey) => apiKey.id === lifecycleApiKeyId)
          : undefined
      if (
        parsed.data.documentKind === "api-key-lifecycle" &&
        lifecycleApiKey?.status !== "active"
      ) {
        return { ok: false, error: "api-key-request-invalid" }
      }
      if (
        parsed.data.documentKind === "api-key-lifecycle" &&
        state.approvalDocuments.some(
          (document) =>
            document.documentKind === "api-key-lifecycle" &&
            document.apiKeyId === lifecycleApiKeyId &&
            document.type === parsed.data.type &&
            document.status === "submitted",
        )
      ) {
        return { ok: false, error: "api-key-request-invalid" }
      }
      const apiKeyServiceId =
        parsed.data.documentKind === "api-key-issuance"
          ? parsed.data.serviceId
          : (lifecycleApiKey?.serviceId ?? null)
      const apiKeyService = state.services.find(
        (service) => service.id === apiKeyServiceId,
      )
      if (apiKeyServiceId !== null && apiKeyService?.status !== "active") {
        return { ok: false, error: "api-key-request-invalid" }
      }
      if (parsed.data.documentKind === "api-key-issuance") {
        const issuanceServiceId = parsed.data.serviceId
        const endpointIdsValid = parsed.data.endpointIds.every((endpointId) =>
          state.serviceEndpoints.some(
            (endpoint) =>
              endpoint.id === endpointId &&
              endpoint.serviceId === issuanceServiceId,
          ),
        )
        if (
          !apiKeyService ||
          !endpointIdsValid ||
          (apiKeyService.type === "internal" &&
            parsed.data.endpointIds.length === 0) ||
          (apiKeyService.type === "external" &&
            parsed.data.endpointIds.length > 0)
        ) {
          return { ok: false, error: "api-key-request-invalid" }
        }
      }
      if (
        parsed.data.documentKind === "api-key-issuance" &&
        resolveOwnedCredentialIds(state, requester.id).some((credentialId) =>
          state.apiKeys.some(
            (credential) =>
              credential.id === credentialId &&
              credential.serviceId === apiKeyServiceId,
          ),
        )
      ) {
        return { ok: false, error: "credential-already-owned" }
      }
      const configuredTemplateId = apiKeyService
        ? parsed.data.type === "api-key"
          ? apiKeyService.credentialTemplateIds.issuance
          : parsed.data.type === "api-key-replace"
            ? apiKeyService.credentialTemplateIds.replacement
            : parsed.data.type === "api-key-dispose"
              ? apiKeyService.credentialTemplateIds.disposal
              : null
        : null
      if (apiKeyService && configuredTemplateId !== line.id) {
        return { ok: false, error: "api-key-request-invalid" }
      }

      const resolvedSteps = line.steps.map<ResolvedApprovalStep | null>(
        (step) => {
          const assignment = parsed.data.stepAssignments.find(
            (item) => item.stepId === step.id,
          )
          let assignee:
            | { type: "user"; id: string }
            | { type: "organization"; id: string }
            | null = null
          switch (step.assigneeMode) {
            case "fixed-user":
              assignee = { type: "user", id: step.userId }
              break
            case "fixed-organization":
              assignee = {
                type: "organization",
                id: step.organizationId,
              }
              break
            case "document-select":
              assignee = assignment
                ? { type: "user", id: assignment.userId }
                : null
              break
            case "requester":
              assignee = { type: "user", id: requester.id }
              break
            case "request-organization-leader":
              {
                const resolvedLeader = resolveRequestOrganizationLeader(
                  state,
                  requestOrganization.id,
                  requester.id,
                )
                assignee = resolvedLeader
                  ? { type: "user", id: resolvedLeader.leader.id }
                  : null
              }
              break
            case "request-organization":
              assignee = {
                type: "organization",
                id: requestOrganization.id,
              }
              break
            case "service-owner-organization":
              assignee = apiKeyService
                ? {
                    type: "organization",
                    id: apiKeyService.ownerOrganizationId,
                  }
                : null
              break
          }
          if (!assignee) return null
          const baseStep = {
            id: step.id,
            order: step.order,
            stage: step.stage,
            kind: step.kind,
            assigneeMode: step.assigneeMode,
          }
          return {
            ...baseStep,
            assigneeType: assignee.type,
            assigneeId: assignee.id,
          }
        },
      )
      if (
        resolvedSteps.some((step) => step === null) ||
        resolvedSteps.some(
          (step) =>
            step !== null &&
            (step.assigneeType === "user"
              ? !state.users.some(
                  (user) =>
                    user.id === step.assigneeId &&
                    user.employmentStatus === "employed",
                )
              : !state.organizations.some(
                  (organization) => organization.id === step.assigneeId,
                )),
        )
      ) {
        return { ok: false, error: "approval-reference-mismatch" }
      }

      const base = {
        id: crypto.randomUUID(),
        title: parsed.data.title,
        organizationId: parsed.data.organizationId,
        requesterId: parsed.data.requesterId,
        approvalLineId: parsed.data.approvalLineId,
        content: parsed.data.content,
        fieldValues: parsed.data.fieldValues,
        status: parsed.data.submission,
        createdAt: new Date().toISOString(),
        approvalSteps: resolvedSteps.filter((step) => step !== null),
      }
      const document: ApprovalDocument =
        parsed.data.documentKind === "api-key-issuance"
          ? {
              ...base,
              documentKind: parsed.data.documentKind,
              type: parsed.data.type,
              serviceId: parsed.data.serviceId,
              endpointIds: parsed.data.endpointIds,
              keyName: parsed.data.keyName,
              awsSecretName: parsed.data.awsSecretName,
              awsSecretKey: parsed.data.awsSecretKey,
            }
          : parsed.data.documentKind === "api-key-lifecycle" &&
              parsed.data.type === "api-key-replace"
            ? {
                ...base,
                documentKind: parsed.data.documentKind,
                type: parsed.data.type,
                apiKeyId: parsed.data.apiKeyId,
                awsSecretName: parsed.data.awsSecretName,
                awsSecretKey: parsed.data.awsSecretKey,
              }
            : parsed.data.documentKind === "api-key-lifecycle"
              ? {
                  ...base,
                  documentKind: parsed.data.documentKind,
                  type: parsed.data.type,
                  apiKeyId: parsed.data.apiKeyId,
                }
              : parsed.data.type === "access-grant"
                ? {
                    ...base,
                    documentKind: parsed.data.documentKind,
                    type: parsed.data.type,
                    accessPolicyId: parsed.data.accessPolicyId,
                  }
                : {
                    ...base,
                    documentKind: parsed.data.documentKind,
                    type: parsed.data.type,
                  }
      const notification =
        parsed.data.submission === "submitted"
          ? createUserNotification(
              document.requesterId,
              "approval-document",
              document.id,
              "request-submitted",
            )
          : null
      updateState((current) => ({
        ...current,
        approvalDocuments: [...current.approvalDocuments, document],
        notifications: notification
          ? [...current.notifications, notification]
          : current.notifications,
      }))
      return { ok: true, value: document }
    },

    approveApprovalDocument: async (id) => {
      await Promise.resolve()
      const document = state.approvalDocuments.find((item) => item.id === id)
      if (!document) {
        return { ok: false, error: "approval-document-not-found" }
      }
      if (document.status !== "submitted") {
        return { ok: false, error: "approval-document-not-submitted" }
      }

      const approvedDocument: ApprovalDocument = {
        ...document,
        status: "approved",
      }
      if (
        document.documentKind === "api-key-lifecycle" &&
        document.type === "api-key-dispose"
      ) {
        const apiKey = state.apiKeys.find(
          (item) => item.id === document.apiKeyId && item.status === "active",
        )
        if (!apiKey) {
          return { ok: false, error: "api-key-request-invalid" }
        }
        const notification = createUserNotification(
          document.requesterId,
          "approval-document",
          document.id,
          approvalCompletionEvent(document),
        )
        updateState((current) => ({
          ...current,
          approvalDocuments: current.approvalDocuments.map((item) =>
            item.id === id ? approvedDocument : item,
          ),
          apiKeys: current.apiKeys.map((item) =>
            item.id === apiKey.id ? { ...item, status: "inactive" } : item,
          ),
          notifications: [...current.notifications, notification],
        }))
        return { ok: true, value: { document: approvedDocument } }
      }
      if (
        document.documentKind === "general" &&
        document.type === "access-grant"
      ) {
        const policy = state.accessPolicies.find(
          (item) => item.id === document.accessPolicyId,
        )
        if (!policy) return { ok: false, error: "policy-not-found" }
        const assignment: AccessPolicyAssignment = {
          ...createRecordBase(),
          accessPolicyId: policy.id,
          targetType: "user",
          targetId: document.requesterId,
        }
        const alreadyAssigned = state.accessPolicyAssignments.some(
          (item) =>
            item.accessPolicyId === assignment.accessPolicyId &&
            item.targetType === assignment.targetType &&
            item.targetId === assignment.targetId,
        )
        const notification = createUserNotification(
          document.requesterId,
          "approval-document",
          document.id,
          approvalCompletionEvent(document),
        )
        updateState((current) => ({
          ...current,
          approvalDocuments: current.approvalDocuments.map((item) =>
            item.id === id ? approvedDocument : item,
          ),
          accessPolicyAssignments: alreadyAssigned
            ? current.accessPolicyAssignments
            : [...current.accessPolicyAssignments, assignment],
          notifications: [...current.notifications, notification],
        }))
        return { ok: true, value: { document: approvedDocument } }
      }
      if (document.documentKind !== "api-key-issuance") {
        const notification = createUserNotification(
          document.requesterId,
          "approval-document",
          document.id,
          approvalCompletionEvent(document),
        )
        updateState((current) => ({
          ...current,
          approvalDocuments: current.approvalDocuments.map((item) =>
            item.id === id ? approvedDocument : item,
          ),
          notifications: [...current.notifications, notification],
        }))
        return { ok: true, value: { document: approvedDocument } }
      }
      updateState((current) => ({
        ...current,
        approvalDocuments: current.approvalDocuments.map((item) =>
          item.id === id ? approvedDocument : item,
        ),
      }))
      return { ok: true, value: { document: approvedDocument } }
    },
  }
}
