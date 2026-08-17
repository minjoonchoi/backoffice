import { approvalDocumentSubmissions } from "@/features/access-policies/model"
import { approvalDocumentHistoryEventTypes } from "@/features/access-policies/model"
import { approvalDecisions } from "@/features/access-policies/model"
import { approvalStepStatuses } from "@/features/access-policies/model"
import { approvalDocumentStatuses } from "@/features/access-policies/model"
import { requestTemplateFieldBindingValues } from "@/features/request-templates/model"
import { approvalStepKindValues } from "@/features/request-templates/model"
import { requestCategoryValues } from "@/features/request-templates/model"
import { approvalTypeValues } from "@/features/request-templates/model"
import { approvalExecutionTypeValues } from "@/features/request-templates/model"
import { approvalDocumentKinds } from "@/features/access-policies/model"
import { approvalAssigneeTypes } from "@/features/access-policies/model"
import { serviceTypeValues } from "@/features/service-catalog/model"
import { employmentStatusValues } from "@/features/iam/model"
import { entityStatuses } from "@/domain/common"
import { hasEffectiveAccessPolicy } from "@/features/access-policies/access-policy-assignment"
import {
  accessPolicyAssignmentTargets,
  approvalDocumentActionInputSchema,
  approvalDocumentInputSchema,
  approvalDocumentTransitionInputSchema,
  accessPolicyManagementTypes,
  type AccessPolicyAssignment,
  type ApprovalDocument,
  type ApprovalDocumentHistoryEvent,
  type ApprovalDocumentStep,
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
import {
  userNotificationEventValues,
  userNotificationTargetTypeValues,
} from "@/application/state/model"
import type { ResolvedApprovalStep } from "@/features/request-templates/model"
import { hasUiResourcePolicyAccess } from "@/auth/ui-resource-policy-access"
import { uiResourceKeys } from "@/config/menu-registry"

function createHistoryEvent(
  type: ApprovalDocumentHistoryEvent["type"],
  actorUserId: string | null,
  stepId: string | null,
  comment: string | null,
  createdAt = new Date().toISOString(),
): ApprovalDocumentHistoryEvent {
  return {
    id: crypto.randomUUID(),
    type,
    actorUserId,
    stepId,
    comment,
    createdAt,
  }
}

function activateApprovalSteps(
  steps: ApprovalDocumentStep[],
  actorUserId: string,
  createdAt: string,
) {
  const prepared = steps.map<ApprovalDocumentStep>((step) =>
    step.kind === approvalStepKindValues.request
      ? {
          ...step,
          status: approvalStepStatuses.completed,
          processedById: actorUserId,
          processedAt: createdAt,
          comment: null,
        }
      : {
          ...step,
          status: approvalStepStatuses.waiting,
          processedById: null,
          processedAt: null,
          comment: null,
        },
  )
  const nextStage = Math.min(
    ...prepared
      .filter((step) => step.status === approvalStepStatuses.waiting)
      .map((step) => step.stage),
  )
  return prepared.map<ApprovalDocumentStep>((step) =>
    step.status === approvalStepStatuses.waiting && step.stage === nextStage
      ? { ...step, status: approvalStepStatuses.pending }
      : step,
  )
}

function isStepAssignee(
  state: BackofficeState,
  step: ApprovalDocumentStep,
  actorUserId: string,
) {
  if (step.assigneeType === approvalAssigneeTypes.user)
    return step.assigneeId === actorUserId
  return state.users.some(
    (user) =>
      user.id === actorUserId &&
      user.employmentStatus === employmentStatusValues.employed &&
      user.organizationIds.includes(step.assigneeId),
  )
}

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
    case approvalTypeValues.resourceCreate:
      return userNotificationEventValues.resourceCreated
    case approvalTypeValues.accessGrant:
      return userNotificationEventValues.accessGranted
    case approvalTypeValues.accessRevoke:
      return userNotificationEventValues.accessRevoked
    case approvalTypeValues.resourceDispose:
      return userNotificationEventValues.resourceDisposed
    case approvalTypeValues.apiKey:
      return userNotificationEventValues.apiKeyIssued
    case approvalTypeValues.apiKeyReplace:
      return userNotificationEventValues.apiKeyReplacementApproved
    case approvalTypeValues.apiKeyDispose:
      return userNotificationEventValues.apiKeyDisposalApproved
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
      if (line?.status !== entityStatuses.active) {
        return { ok: false, error: "approval-line-not-found" }
      }
      const requester = state.users.find(
        (user) => user.id === parsed.data.requesterId,
      )
      const requestOrganization = state.organizations.find(
        (organization) => organization.id === parsed.data.organizationId,
      )
      if (
        requester?.employmentStatus !== employmentStatusValues.employed ||
        !requestOrganization ||
        !requester.organizationIds.includes(requestOrganization.id)
      ) {
        return { ok: false, error: "user-not-found" }
      }
      if (
        line.type !== parsed.data.type ||
        (line.category === requestCategoryValues.credential) !==
          parsed.data.type.startsWith("api-key")
      ) {
        return { ok: false, error: "approval-reference-mismatch" }
      }
      const accessPolicyId =
        parsed.data.documentKind === approvalDocumentKinds.general &&
        parsed.data.type === approvalTypeValues.accessGrant
          ? parsed.data.accessPolicyId
          : null
      const accessPolicy = state.accessPolicies.find(
        (policy) => policy.id === accessPolicyId,
      )
      if (
        parsed.data.documentKind === approvalDocumentKinds.general &&
        parsed.data.type === approvalTypeValues.accessGrant &&
        (accessPolicy?.status !== entityStatuses.active ||
          accessPolicy.managementType ===
            accessPolicyManagementTypes.systemManaged ||
          accessPolicy.type !== line.type ||
          new Date(parsed.data.expiresAt).getTime() <= Date.now())
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
        (field) => field.binding === requestTemplateFieldBindingValues.custom,
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
        parsed.data.documentKind === approvalDocumentKinds.apiKeyLifecycle
          ? parsed.data.apiKeyId
          : null
      const lifecycleApiKey =
        lifecycleApiKeyId !== null
          ? state.apiKeys.find((apiKey) => apiKey.id === lifecycleApiKeyId)
          : undefined
      if (
        parsed.data.documentKind === approvalDocumentKinds.apiKeyLifecycle &&
        lifecycleApiKey?.status !== entityStatuses.active
      ) {
        return { ok: false, error: "api-key-request-invalid" }
      }
      if (
        parsed.data.documentKind === approvalDocumentKinds.apiKeyLifecycle &&
        state.approvalDocuments.some(
          (document) =>
            document.documentKind === approvalDocumentKinds.apiKeyLifecycle &&
            document.apiKeyId === lifecycleApiKeyId &&
            document.type === parsed.data.type &&
            document.status === approvalDocumentStatuses.submitted,
        )
      ) {
        return { ok: false, error: "api-key-request-invalid" }
      }
      const apiKeyServiceId =
        parsed.data.documentKind === approvalDocumentKinds.apiKeyIssuance
          ? parsed.data.serviceId
          : (lifecycleApiKey?.serviceId ?? null)
      const apiKeyService = state.services.find(
        (service) => service.id === apiKeyServiceId,
      )
      if (
        apiKeyServiceId !== null &&
        apiKeyService?.status !== entityStatuses.active
      ) {
        return { ok: false, error: "api-key-request-invalid" }
      }
      if (parsed.data.documentKind === approvalDocumentKinds.apiKeyIssuance) {
        const applicationId = parsed.data.applicationId
        const application = state.applications.find(
          (candidate) => candidate.id === applicationId,
        )
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
          application?.ownerOrganizationId !== requestOrganization.id ||
          !endpointIdsValid ||
          (apiKeyService.type === serviceTypeValues.internal &&
            parsed.data.endpointIds.length === 0) ||
          (apiKeyService.type === serviceTypeValues.external &&
            parsed.data.endpointIds.length > 0)
        ) {
          return { ok: false, error: "api-key-request-invalid" }
        }
      }
      if (parsed.data.documentKind === approvalDocumentKinds.apiKeyIssuance) {
        const applicationId = parsed.data.applicationId
        if (
          state.apiKeys.some(
            (credential) =>
              credential.applicationId === applicationId &&
              credential.serviceId === apiKeyServiceId &&
              credential.status === entityStatuses.active,
          )
        ) {
          return { ok: false, error: "credential-already-owned" }
        }
      }
      const configuredTemplateId = apiKeyService
        ? parsed.data.type === approvalTypeValues.apiKey
          ? apiKeyService.credentialTemplateIds.issuance
          : parsed.data.type === approvalTypeValues.apiKeyReplace
            ? apiKeyService.credentialTemplateIds.replacement
            : parsed.data.type === approvalTypeValues.apiKeyDispose
              ? apiKeyService.credentialTemplateIds.disposal
              : null
        : null
      if (apiKeyService && configuredTemplateId !== line.id) {
        return { ok: false, error: "api-key-request-invalid" }
      }

      const requestStep = parsed.data.approvalSteps[0]
      const internalStepsInvalid =
        line.approvalExecution.type === approvalExecutionTypeValues.internal &&
        (requestStep?.kind !== approvalStepKindValues.request ||
          requestStep.assigneeType !== approvalAssigneeTypes.user ||
          requestStep.assigneeId !== requester.id ||
          parsed.data.approvalSteps.some((step) =>
            step.assigneeType === approvalAssigneeTypes.user
              ? !state.users.some(
                  (user) =>
                    user.id === step.assigneeId &&
                    user.employmentStatus === employmentStatusValues.employed,
                )
              : !state.organizations.some(
                  (organization) => organization.id === step.assigneeId,
                ),
          ) ||
          parsed.data.approvalSteps.some(
            (step) =>
              (step.kind === approvalStepKindValues.approval ||
                step.kind === approvalStepKindValues.agreement) &&
              step.assigneeType === approvalAssigneeTypes.user &&
              step.assigneeId === requester.id,
          ))
      const grooSubmissionInvalid =
        line.approvalExecution.type === approvalExecutionTypeValues.groo &&
        (parsed.data.approvalSteps.length > 0 ||
          parsed.data.submission !== approvalDocumentSubmissions.submitted)
      if (internalStepsInvalid || grooSubmissionInvalid) {
        return { ok: false, error: "approval-reference-mismatch" }
      }

      const resolvedSteps = parsed.data.approvalSteps.map<ResolvedApprovalStep>(
        (step, index) => ({
          id: step.id,
          order: index + 1,
          stage: step.stage,
          kind: step.kind,
          assigneeMode:
            step.kind === approvalStepKindValues.request
              ? "requester"
              : step.assigneeType === approvalAssigneeTypes.user
                ? "document-select"
                : "fixed-organization",
          assigneeType: step.assigneeType,
          assigneeId: step.assigneeId,
        }),
      )

      const createdAt = new Date().toISOString()
      const unresolvedApprovalSteps = resolvedSteps.map<ApprovalDocumentStep>(
        (step) => ({
          ...step,
          status: approvalStepStatuses.waiting,
          processedById: null,
          processedAt: null,
          comment: null,
        }),
      )
      const approvalSteps =
        parsed.data.submission === approvalDocumentSubmissions.submitted
          ? activateApprovalSteps(
              unresolvedApprovalSteps,
              requester.id,
              createdAt,
            )
          : unresolvedApprovalSteps
      const initialHistoryType =
        parsed.data.submission === approvalDocumentSubmissions.submitted
          ? approvalDocumentHistoryEventTypes.submitted
          : approvalDocumentHistoryEventTypes.draftSaved
      const base = {
        id: crypto.randomUUID(),
        title: parsed.data.title,
        organizationId: parsed.data.organizationId,
        requesterId: parsed.data.requesterId,
        approvalLineId: parsed.data.approvalLineId,
        content: parsed.data.content,
        fieldValues: parsed.data.fieldValues,
        status: parsed.data.submission,
        createdAt,
        approvalExecution:
          line.approvalExecution.type === approvalExecutionTypeValues.groo
            ? {
                ...line.approvalExecution,
                requestId: `groo-${crypto.randomUUID()}`,
              }
            : line.approvalExecution,
        approvalSteps,
        history: [
          createHistoryEvent(
            initialHistoryType,
            requester.id,
            null,
            null,
            createdAt,
          ),
        ],
      }
      const document: ApprovalDocument =
        parsed.data.documentKind === approvalDocumentKinds.apiKeyIssuance
          ? {
              ...base,
              documentKind: parsed.data.documentKind,
              type: parsed.data.type,
              applicationId: parsed.data.applicationId,
              serviceId: parsed.data.serviceId,
              endpointIds: parsed.data.endpointIds,
              keyName: parsed.data.keyName,
              awsSecretName: parsed.data.awsSecretName,
              awsSecretKey: parsed.data.awsSecretKey,
            }
          : parsed.data.documentKind ===
                approvalDocumentKinds.apiKeyLifecycle &&
              parsed.data.type === approvalTypeValues.apiKeyReplace
            ? {
                ...base,
                documentKind: parsed.data.documentKind,
                type: parsed.data.type,
                apiKeyId: parsed.data.apiKeyId,
                awsSecretName: parsed.data.awsSecretName,
                awsSecretKey: parsed.data.awsSecretKey,
              }
            : parsed.data.documentKind === approvalDocumentKinds.apiKeyLifecycle
              ? {
                  ...base,
                  documentKind: parsed.data.documentKind,
                  type: parsed.data.type,
                  apiKeyId: parsed.data.apiKeyId,
                }
              : parsed.data.type === approvalTypeValues.accessGrant
                ? {
                    ...base,
                    documentKind: parsed.data.documentKind,
                    type: parsed.data.type,
                    accessPolicyId: parsed.data.accessPolicyId,
                    expiresAt: parsed.data.expiresAt,
                  }
                : {
                    ...base,
                    documentKind: parsed.data.documentKind,
                    type: parsed.data.type,
                  }
      const notification =
        parsed.data.submission === approvalDocumentSubmissions.submitted
          ? createUserNotification(
              document.requesterId,
              userNotificationTargetTypeValues.approvalDocument,
              document.id,
              userNotificationEventValues.requestSubmitted,
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

    processApprovalDocument: async (input) => {
      await Promise.resolve()
      const parsed = approvalDocumentActionInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (
        !hasUiResourcePolicyAccess(
          state,
          parsed.data.actorUserId,
          uiResourceKeys.approvalDocuments.requestDetail.actions.processRequest,
        )
      ) {
        return { ok: false, error: "approval-document-action-forbidden" }
      }
      const document = state.approvalDocuments.find(
        (item) => item.id === parsed.data.documentId,
      )
      if (!document) {
        return { ok: false, error: "approval-document-not-found" }
      }
      if (
        document.approvalExecution.type === approvalExecutionTypeValues.groo
      ) {
        return { ok: false, error: "approval-document-action-forbidden" }
      }
      if (document.status !== approvalDocumentStatuses.submitted) {
        return { ok: false, error: "approval-document-not-submitted" }
      }
      const step = document.approvalSteps.find(
        (candidate) => candidate.id === parsed.data.stepId,
      )
      if (step?.status !== approvalStepStatuses.pending) {
        return { ok: false, error: "approval-document-step-not-actionable" }
      }
      if (!isStepAssignee(state, step, parsed.data.actorUserId)) {
        return { ok: false, error: "approval-document-action-forbidden" }
      }
      const decisionMatchesStep =
        step.kind === approvalStepKindValues.reference
          ? parsed.data.decision === approvalDecisions.acknowledge
          : (step.kind === approvalStepKindValues.approval ||
              step.kind === approvalStepKindValues.agreement) &&
            (parsed.data.decision === approvalDecisions.approve ||
              parsed.data.decision === approvalDecisions.reject)
      if (
        !decisionMatchesStep ||
        (parsed.data.decision === approvalDecisions.reject &&
          !parsed.data.comment)
      ) {
        return { ok: false, error: "invalid-input" }
      }

      const processedAt = new Date().toISOString()
      const processedSteps = document.approvalSteps.map<ApprovalDocumentStep>(
        (candidate) =>
          candidate.id === step.id
            ? {
                ...candidate,
                status:
                  parsed.data.decision === approvalDecisions.reject
                    ? approvalStepStatuses.rejected
                    : approvalStepStatuses.completed,
                processedById: parsed.data.actorUserId,
                processedAt,
                comment: parsed.data.comment || null,
              }
            : candidate,
      )
      const rejected = parsed.data.decision === approvalDecisions.reject
      const pendingInStage = processedSteps.some(
        (candidate) =>
          candidate.stage === step.stage &&
          candidate.status === approvalStepStatuses.pending,
      )
      const nextStage = Math.min(
        ...processedSteps
          .filter(
            (candidate) => candidate.status === approvalStepStatuses.waiting,
          )
          .map((candidate) => candidate.stage),
      )
      const hasNextStage = Number.isFinite(nextStage)
      const approvalSteps =
        !rejected && !pendingInStage && hasNextStage
          ? processedSteps.map<ApprovalDocumentStep>((candidate) =>
              candidate.status === approvalStepStatuses.waiting &&
              candidate.stage === nextStage
                ? { ...candidate, status: approvalStepStatuses.pending }
                : candidate,
            )
          : processedSteps
      const completed = !rejected && !pendingInStage && !hasNextStage
      const eventType: ApprovalDocumentHistoryEvent["type"] = rejected
        ? "rejected"
        : step.kind === approvalStepKindValues.agreement
          ? "agreed"
          : step.kind === approvalStepKindValues.reference
            ? "referenced"
            : "approved"
      const nextDocument: ApprovalDocument = {
        ...document,
        status: rejected ? "rejected" : completed ? "approved" : "submitted",
        approvalSteps,
        history: [
          ...document.history,
          createHistoryEvent(
            eventType,
            parsed.data.actorUserId,
            step.id,
            parsed.data.comment || null,
            processedAt,
          ),
        ],
      }
      if (rejected) {
        const notification = createUserNotification(
          document.requesterId,
          userNotificationTargetTypeValues.approvalDocument,
          document.id,
          userNotificationEventValues.requestRejected,
        )
        updateState((current) => ({
          ...current,
          approvalDocuments: current.approvalDocuments.map((item) =>
            item.id === document.id ? nextDocument : item,
          ),
          notifications: [...current.notifications, notification],
        }))
        return { ok: true, value: { document: nextDocument } }
      }
      if (!completed) {
        updateState((current) => ({
          ...current,
          approvalDocuments: current.approvalDocuments.map((item) =>
            item.id === document.id ? nextDocument : item,
          ),
        }))
        return { ok: true, value: { document: nextDocument } }
      }
      if (
        document.documentKind === approvalDocumentKinds.apiKeyLifecycle &&
        document.type === approvalTypeValues.apiKeyDispose
      ) {
        const apiKey = state.apiKeys.find(
          (item) =>
            item.id === document.apiKeyId &&
            item.status === entityStatuses.active,
        )
        if (!apiKey) {
          return { ok: false, error: "api-key-request-invalid" }
        }
        const notification = createUserNotification(
          document.requesterId,
          userNotificationTargetTypeValues.approvalDocument,
          document.id,
          approvalCompletionEvent(document),
        )
        updateState((current) => ({
          ...current,
          approvalDocuments: current.approvalDocuments.map((item) =>
            item.id === document.id ? nextDocument : item,
          ),
          apiKeys: current.apiKeys.map((item) =>
            item.id === apiKey.id
              ? { ...item, status: entityStatuses.inactive }
              : item,
          ),
          accessPolicies: current.accessPolicies.map((policy) =>
            apiKey.accessPolicyId !== null &&
            policy.id === apiKey.accessPolicyId
              ? { ...policy, status: entityStatuses.inactive }
              : policy,
          ),
          notifications: [...current.notifications, notification],
        }))
        return { ok: true, value: { document: nextDocument } }
      }
      if (
        document.documentKind === approvalDocumentKinds.general &&
        document.type === approvalTypeValues.accessGrant
      ) {
        const policy = state.accessPolicies.find(
          (item) => item.id === document.accessPolicyId,
        )
        if (!policy) return { ok: false, error: "policy-not-found" }
        const assignment: AccessPolicyAssignment = {
          ...createRecordBase(),
          accessPolicyId: policy.id,
          targetType: accessPolicyAssignmentTargets.user,
          targetId: document.requesterId,
          expiresAt: document.expiresAt,
        }
        const alreadyAssigned = state.accessPolicyAssignments.some(
          (item) =>
            item.accessPolicyId === assignment.accessPolicyId &&
            item.targetType === assignment.targetType &&
            item.targetId === assignment.targetId,
        )
        const notification = createUserNotification(
          document.requesterId,
          userNotificationTargetTypeValues.approvalDocument,
          document.id,
          approvalCompletionEvent(document),
        )
        updateState((current) => ({
          ...current,
          approvalDocuments: current.approvalDocuments.map((item) =>
            item.id === document.id ? nextDocument : item,
          ),
          accessPolicyAssignments: alreadyAssigned
            ? current.accessPolicyAssignments.map((item) =>
                item.accessPolicyId === assignment.accessPolicyId &&
                item.targetType === assignment.targetType &&
                item.targetId === assignment.targetId
                  ? { ...item, expiresAt: assignment.expiresAt }
                  : item,
              )
            : [...current.accessPolicyAssignments, assignment],
          notifications: [...current.notifications, notification],
        }))
        return { ok: true, value: { document: nextDocument } }
      }
      if (document.documentKind !== approvalDocumentKinds.apiKeyIssuance) {
        const notification = createUserNotification(
          document.requesterId,
          "approval-document",
          document.id,
          approvalCompletionEvent(document),
        )
        updateState((current) => ({
          ...current,
          approvalDocuments: current.approvalDocuments.map((item) =>
            item.id === document.id ? nextDocument : item,
          ),
          notifications: [...current.notifications, notification],
        }))
        return { ok: true, value: { document: nextDocument } }
      }
      updateState((current) => ({
        ...current,
        approvalDocuments: current.approvalDocuments.map((item) =>
          item.id === document.id ? nextDocument : item,
        ),
      }))
      return { ok: true, value: { document: nextDocument } }
    },

    withdrawApprovalDocument: async (input) => {
      await Promise.resolve()
      const parsed = approvalDocumentTransitionInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (
        !hasUiResourcePolicyAccess(
          state,
          parsed.data.actorUserId,
          uiResourceKeys.approvalDocuments.requestDetail.actions
            .withdrawRequest,
        )
      ) {
        return { ok: false, error: "approval-document-action-forbidden" }
      }
      const document = state.approvalDocuments.find(
        (item) => item.id === parsed.data.documentId,
      )
      if (!document) {
        return { ok: false, error: "approval-document-not-found" }
      }
      if (
        document.approvalExecution.type === approvalExecutionTypeValues.groo
      ) {
        return { ok: false, error: "approval-document-transition-invalid" }
      }
      if (
        document.status !== approvalDocumentStatuses.submitted ||
        document.requesterId !== parsed.data.actorUserId
      ) {
        return { ok: false, error: "approval-document-transition-invalid" }
      }
      const createdAt = new Date().toISOString()
      const withdrawnDocument: ApprovalDocument = {
        ...document,
        status: approvalDocumentStatuses.withdrawn,
        history: [
          ...document.history,
          createHistoryEvent(
            approvalDocumentHistoryEventTypes.withdrawn,
            parsed.data.actorUserId,
            null,
            null,
            createdAt,
          ),
        ],
      }
      const notification = createUserNotification(
        document.requesterId,
        "approval-document",
        document.id,
        "request-withdrawn",
      )
      updateState((current) => ({
        ...current,
        approvalDocuments: current.approvalDocuments.map((item) =>
          item.id === document.id ? withdrawnDocument : item,
        ),
        notifications: [...current.notifications, notification],
      }))
      return { ok: true, value: withdrawnDocument }
    },

    resubmitApprovalDocument: async (input) => {
      await Promise.resolve()
      const parsed = approvalDocumentTransitionInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (
        !hasUiResourcePolicyAccess(
          state,
          parsed.data.actorUserId,
          uiResourceKeys.approvalDocuments.requestDetail.actions
            .resubmitRequest,
        )
      ) {
        return { ok: false, error: "approval-document-action-forbidden" }
      }
      const document = state.approvalDocuments.find(
        (item) => item.id === parsed.data.documentId,
      )
      if (!document) {
        return { ok: false, error: "approval-document-not-found" }
      }
      if (
        document.approvalExecution.type === approvalExecutionTypeValues.groo
      ) {
        return { ok: false, error: "approval-document-transition-invalid" }
      }
      const resubmittable =
        document.status === approvalDocumentStatuses.draft ||
        document.status === approvalDocumentStatuses.rejected ||
        document.status === approvalDocumentStatuses.withdrawn
      if (!resubmittable || document.requesterId !== parsed.data.actorUserId) {
        return { ok: false, error: "approval-document-transition-invalid" }
      }
      const requester = state.users.find(
        (user) => user.id === document.requesterId,
      )
      const template = state.approvalLines.find(
        (line) => line.id === document.approvalLineId,
      )
      if (
        requester?.employmentStatus !== employmentStatusValues.employed ||
        !requester.organizationIds.includes(document.organizationId) ||
        template?.status !== entityStatuses.active
      ) {
        return { ok: false, error: "approval-reference-mismatch" }
      }
      const referencesValid = document.approvalSteps.every((step) =>
        step.assigneeType === approvalAssigneeTypes.user
          ? state.users.some(
              (user) =>
                user.id === step.assigneeId &&
                user.employmentStatus === employmentStatusValues.employed,
            )
          : state.organizations.some(
              (organization) => organization.id === step.assigneeId,
            ),
      )
      if (!referencesValid) {
        return { ok: false, error: "approval-reference-mismatch" }
      }
      const createdAt = new Date().toISOString()
      const approvalSteps = activateApprovalSteps(
        document.approvalSteps,
        parsed.data.actorUserId,
        createdAt,
      )
      const submittedDocument: ApprovalDocument = {
        ...document,
        status: approvalDocumentStatuses.submitted,
        approvalSteps,
        history: [
          ...document.history,
          createHistoryEvent(
            document.status === approvalDocumentStatuses.draft
              ? approvalDocumentHistoryEventTypes.submitted
              : approvalDocumentHistoryEventTypes.resubmitted,
            parsed.data.actorUserId,
            null,
            null,
            createdAt,
          ),
        ],
      }
      const notification = createUserNotification(
        document.requesterId,
        "approval-document",
        document.id,
        "request-submitted",
      )
      updateState((current) => ({
        ...current,
        approvalDocuments: current.approvalDocuments.map((item) =>
          item.id === document.id ? submittedDocument : item,
        ),
        notifications: [...current.notifications, notification],
      }))
      return { ok: true, value: { document: submittedDocument } }
    },
  }
}
