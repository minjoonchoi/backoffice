import { accessPolicyAssignmentTargets } from "@/features/access-policies/model"
import { accessPolicyResourceTypes } from "@/features/access-policies/model"
import { serviceTypeValues } from "@/features/service-catalog/model"
import { entityStatuses } from "@/domain/common"
import { hasUiResourcePolicyAccess } from "@/auth/ui-resource-policy-access"
import { uiResourceKeys } from "@/config/menu-registry"
import { accessPolicyApprovalLines } from "@/features/access-policies/access-policy-template"
import {
  accessPolicyInputSchema,
  accessPolicyAssignmentTargetSchema,
  accessPolicyManagementTypes,
  type AccessPolicy,
  type AccessPolicyInput,
  type AccessPolicyValue,
} from "@/features/access-policies/model"
import type { AccessPolicyApi } from "@/features/access-policies/api"
import {
  createEntityBase,
  createRecordBase,
  type BackofficeStateUpdater,
} from "@/application/api/local-state"
import type { BackofficeState } from "@/application/state/model"
import {
  userNotificationEventValues,
  userNotificationTargetTypeValues,
} from "@/application/state/model"
import {
  entityIdListSchema,
  entityIdSchema,
  type BackofficeErrorCode,
} from "@/domain/common"
import {
  resolveAccessPolicyUpdateImpact,
  type AccessPolicyUpdateImpact,
} from "@/features/access-policies/access-policy-assignment"
import { isAccessPolicyEffective } from "@/features/access-policies/access-policy-status"

function accessPolicyReferenceError(
  input: AccessPolicyInput,
  state: Pick<
    BackofficeState,
    | "approvalLines"
    | "serviceEndpoints"
    | "services"
    | "namespaces"
    | "uiResources"
  >,
):
  | "approval-line-not-found"
  | "approval-line-ambiguous"
  | "endpoint-not-found"
  | "ui-resource-namespace-mismatch"
  | "ui-resource-not-found"
  | null {
  const approvalLines = accessPolicyApprovalLines(state, input.type)
  if (approvalLines.length === 0) return "approval-line-not-found"
  if (approvalLines.length > 1) return "approval-line-ambiguous"

  const uiResourceNamespaceIds = new Set<string>()
  for (const resource of input.resources) {
    if (resource.type === accessPolicyResourceTypes.endpoint) {
      const endpoint = state.serviceEndpoints.find(
        (item) => item.id === resource.id,
      )
      if (
        !endpoint ||
        !state.services.some(
          (service) =>
            service.id === endpoint.serviceId &&
            service.status === entityStatuses.active &&
            service.type === serviceTypeValues.internal,
        )
      ) {
        return "endpoint-not-found"
      }
      continue
    }
    const uiResource = state.uiResources.find(
      (item) => item.id === resource.id && item.orphanedAt === null,
    )
    if (
      !uiResource ||
      !state.namespaces.some(
        (namespace) =>
          namespace.id === uiResource.namespaceId &&
          namespace.status === entityStatuses.active,
      )
    ) {
      return "ui-resource-not-found"
    }
    uiResourceNamespaceIds.add(uiResource.namespaceId)
  }
  if (uiResourceNamespaceIds.size > 1) {
    return "ui-resource-namespace-mismatch"
  }
  return null
}

type AccessPolicyUpdateValidation =
  | Readonly<{
      ok: true
      existing: AccessPolicy
      input: AccessPolicyValue
    }>
  | Readonly<{ ok: false; error: BackofficeErrorCode }>

function validateAccessPolicyUpdate(
  state: BackofficeState,
  id: string,
  input: AccessPolicyInput,
  requesterId: string,
): AccessPolicyUpdateValidation {
  if (
    !hasUiResourcePolicyAccess(
      state,
      requesterId,
      uiResourceKeys.approvalDocuments.detail.actions.updatePolicy,
    )
  ) {
    return { ok: false, error: "policy-operation-forbidden" }
  }
  const existing = state.accessPolicies.find((policy) => policy.id === id)
  if (!existing) return { ok: false, error: "policy-not-found" }
  const parsed = accessPolicyInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid-input" }
  const normalizedName = parsed.data.name.toLocaleLowerCase()
  if (
    state.accessPolicies.some(
      (policy) =>
        policy.id !== id && policy.name.toLocaleLowerCase() === normalizedName,
    )
  ) {
    return { ok: false, error: "policy-name-exists" }
  }
  const referenceError = accessPolicyReferenceError(parsed.data, state)
  return referenceError
    ? { ok: false, error: referenceError }
    : { ok: true, existing, input: parsed.data }
}

function hasPolicyChanges(impact: AccessPolicyUpdateImpact) {
  return (
    impact.nameChanged ||
    impact.descriptionChanged ||
    impact.effectChanged ||
    impact.addedResources.length > 0 ||
    impact.removedResources.length > 0
  )
}

export function createLocalAccessPolicyApi(
  state: BackofficeState,
  updateState: BackofficeStateUpdater,
): AccessPolicyApi {
  return {
    assignAccessPoliciesToTarget: async (
      accessPolicyIds,
      targetType,
      targetId,
      requesterId,
    ) => {
      await Promise.resolve()
      const parsedPolicyIds = entityIdListSchema.safeParse(accessPolicyIds)
      if (
        !parsedPolicyIds.success ||
        !accessPolicyAssignmentTargetSchema.safeParse(targetType).success ||
        !entityIdSchema.safeParse(targetId).success
      ) {
        return { ok: false, error: "invalid-input" }
      }
      const permissionKey =
        targetType === accessPolicyAssignmentTargets.role
          ? uiResourceKeys.roles.detail.actions.assignRolePolicy
          : null
      if (
        !permissionKey ||
        !hasUiResourcePolicyAccess(state, requesterId, permissionKey)
      ) {
        return { ok: false, error: "policy-assignment-forbidden" }
      }
      const targetExists =
        targetType === accessPolicyAssignmentTargets.role &&
        state.roles.some((role) => role.id === targetId)
      if (!targetExists) {
        return { ok: false, error: "role-not-found" }
      }
      if (
        parsedPolicyIds.data.some((id) =>
          state.accessPolicies.some(
            (policy) =>
              policy.id === id &&
              policy.managementType === accessPolicyManagementTypes.system,
          ),
        )
      ) {
        return { ok: false, error: "policy-assignment-forbidden" }
      }
      if (
        !parsedPolicyIds.data.every((id) =>
          state.accessPolicies.some(
            (policy) =>
              policy.id === id &&
              policy.managementType === accessPolicyManagementTypes.general &&
              isAccessPolicyEffective(policy),
          ),
        )
      ) {
        return { ok: false, error: "policy-not-found" }
      }
      const assignments = parsedPolicyIds.data.flatMap((accessPolicyId) =>
        state.accessPolicyAssignments.some(
          (assignment) =>
            assignment.accessPolicyId === accessPolicyId &&
            assignment.targetType === targetType &&
            assignment.targetId === targetId,
        )
          ? []
          : [
              {
                ...createRecordBase(),
                accessPolicyId,
                targetType,
                targetId,
                expiresAt: null,
              },
            ],
      )
      updateState((current) => ({
        ...current,
        accessPolicyAssignments: [
          ...current.accessPolicyAssignments,
          ...assignments,
        ],
      }))
      return { ok: true, value: assignments }
    },

    unassignAccessPolicyFromTarget: async (assignmentId, requesterId) => {
      await Promise.resolve()
      if (!entityIdSchema.safeParse(assignmentId).success) {
        return { ok: false, error: "invalid-input" }
      }
      const assignment = state.accessPolicyAssignments.find(
        (candidate) => candidate.id === assignmentId,
      )
      if (!assignment) {
        return { ok: false, error: "policy-assignment-not-found" }
      }
      const permissionKey =
        assignment.targetType === accessPolicyAssignmentTargets.role
          ? uiResourceKeys.roles.detail.actions.assignRolePolicy
          : null
      if (
        !permissionKey ||
        !hasUiResourcePolicyAccess(state, requesterId, permissionKey)
      ) {
        return { ok: false, error: "policy-assignment-forbidden" }
      }
      const protectedAssignment = state.namespaces.some(
        (namespace) =>
          namespace.managerRoleId === assignment.targetId &&
          namespace.managerAccessPolicyId === assignment.accessPolicyId,
      )
      if (protectedAssignment) {
        return { ok: false, error: "protected-relationship" }
      }
      updateState((current) => ({
        ...current,
        accessPolicyAssignments: current.accessPolicyAssignments.filter(
          (candidate) => candidate.id !== assignmentId,
        ),
      }))
      return { ok: true, value: assignment }
    },

    createAccessPolicy: async (input, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.approvalDocuments.list.actions.createPolicy,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      const parsed = accessPolicyInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      const normalizedName = parsed.data.name.toLocaleLowerCase()
      if (
        state.accessPolicies.some(
          (policy) => policy.name.toLocaleLowerCase() === normalizedName,
        )
      ) {
        return { ok: false, error: "policy-name-exists" }
      }
      const referenceError = accessPolicyReferenceError(parsed.data, state)
      if (referenceError) return { ok: false, error: referenceError }
      const policy: AccessPolicy = {
        ...parsed.data,
        managementType: accessPolicyManagementTypes.general,
        ...createEntityBase(),
      }
      updateState((current) => ({
        ...current,
        accessPolicies: [...current.accessPolicies, policy],
      }))
      return { ok: true, value: policy }
    },

    analyzeAccessPolicyUpdate: async (id, input, requesterId) => {
      await Promise.resolve()
      const validation = validateAccessPolicyUpdate(
        state,
        id,
        input,
        requesterId,
      )
      if (!validation.ok) return validation
      return {
        ok: true,
        value: resolveAccessPolicyUpdateImpact(
          state,
          validation.existing,
          validation.input,
        ),
      }
    },

    updateAccessPolicy: async (id, input, requesterId) => {
      await Promise.resolve()
      const validation = validateAccessPolicyUpdate(
        state,
        id,
        input,
        requesterId,
      )
      if (!validation.ok) return validation
      const impact = resolveAccessPolicyUpdateImpact(
        state,
        validation.existing,
        validation.input,
      )
      const policy: AccessPolicy = {
        ...validation.existing,
        ...validation.input,
      }
      const notifications = hasPolicyChanges(impact)
        ? impact.notificationRecipientUserIds.map((userId) => ({
            userId,
            event: userNotificationEventValues.accessPolicyUpdated,
            targetType: userNotificationTargetTypeValues.accessPolicy,
            targetId: policy.id,
            readAt: null,
            ...createRecordBase(),
          }))
        : []
      updateState((current) => ({
        ...current,
        accessPolicies: current.accessPolicies.map((item) =>
          item.id === id ? policy : item,
        ),
      }))
      if (notifications.length > 0) {
        queueMicrotask(() => {
          updateState((current) => ({
            ...current,
            notifications: [...current.notifications, ...notifications],
          }))
        })
      }
      return { ok: true, value: policy }
    },

    deleteAccessPolicy: async (id, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.approvalDocuments.detail.actions.deletePolicy,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      const existing = state.accessPolicies.find((policy) => policy.id === id)
      if (!existing) return { ok: false, error: "policy-not-found" }
      if (existing.managementType === accessPolicyManagementTypes.system) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      const policy: AccessPolicy = {
        ...existing,
        status: entityStatuses.inactive,
      }
      updateState((current) => ({
        ...current,
        accessPolicies: current.accessPolicies.map((item) =>
          item.id === id ? policy : item,
        ),
      }))
      return { ok: true, value: policy }
    },
  }
}
