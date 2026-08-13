import { hasUiResourcePolicyAccess } from "@/auth/ui-resource-policy-access"
import { uiResourceKeys } from "@/config/menu-registry"
import { accessPolicyApprovalLines } from "@/features/access-policies/access-policy-template"
import {
  accessPolicyInputSchema,
  accessPolicyAssignmentTargetSchema,
  type AccessPolicy,
  type AccessPolicyInput,
} from "@/features/access-policies/model"
import type { AccessPolicyApi } from "@/features/access-policies/api"
import {
  createEntityBase,
  createRecordBase,
  type BackofficeStateUpdater,
} from "@/application/api/local-state"
import type { BackofficeState } from "@/application/state/model"
import { entityIdListSchema, entityIdSchema } from "@/domain/common"
import { resolveAccessPolicyUpdateImpact } from "@/features/access-policies/access-policy-assignment"

function accessPolicyReferenceError(
  input: AccessPolicyInput,
  state: Pick<
    BackofficeState,
    | "approvalLines"
    | "serviceEndpoints"
    | "services"
    | "uiNamespaces"
    | "uiResources"
  >,
):
  | "approval-line-not-found"
  | "approval-line-ambiguous"
  | "endpoint-not-found"
  | "ui-namespace-not-found"
  | "ui-resource-namespace-mismatch"
  | "ui-resource-not-found"
  | null {
  const approvalLines = accessPolicyApprovalLines(state, input.type)
  if (approvalLines.length === 0) return "approval-line-not-found"
  if (approvalLines.length > 1) return "approval-line-ambiguous"

  const uiResourceNamespaceIds = new Set<string>()
  for (const resource of input.resources) {
    if (resource.type === "endpoint") {
      const endpoint = state.serviceEndpoints.find(
        (item) => item.id === resource.id,
      )
      if (
        !endpoint ||
        !state.services.some(
          (service) =>
            service.id === endpoint.serviceId &&
            service.status === "active" &&
            service.type === "internal",
        )
      ) {
        return "endpoint-not-found"
      }
      continue
    }
    if (resource.type === "ui-namespace") {
      if (
        !state.uiNamespaces.some(
          (namespace) =>
            namespace.id === resource.id && namespace.status === "active",
        )
      ) {
        return "ui-namespace-not-found"
      }
      continue
    }
    const uiResource = state.uiResources.find(
      (item) => item.id === resource.id && item.orphanedAt === null,
    )
    if (
      !uiResource ||
      !state.uiNamespaces.some(
        (namespace) =>
          namespace.id === uiResource.namespaceId &&
          namespace.status === "active",
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
        targetType === "role"
          ? uiResourceKeys.roles.detail.actions.assignRolePolicy
          : targetType === "group"
            ? uiResourceKeys.groups.detail.actions.assignGroupPolicy
            : null
      if (
        !permissionKey ||
        !hasUiResourcePolicyAccess(state, requesterId, permissionKey)
      ) {
        return { ok: false, error: "policy-assignment-forbidden" }
      }
      const targetExists =
        targetType === "role"
          ? state.roles.some((role) => role.id === targetId)
          : state.groups.some((group) => group.id === targetId)
      if (!targetExists) {
        return {
          ok: false,
          error: targetType === "role" ? "role-not-found" : "group-not-found",
        }
      }
      if (
        !parsedPolicyIds.data.every((id) =>
          state.accessPolicies.some(
            (policy) => policy.id === id && policy.status === "active",
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
        assignment.targetType === "role"
          ? uiResourceKeys.roles.detail.actions.assignRolePolicy
          : assignment.targetType === "group"
            ? uiResourceKeys.groups.detail.actions.assignGroupPolicy
            : null
      if (
        !permissionKey ||
        !hasUiResourcePolicyAccess(state, requesterId, permissionKey)
      ) {
        return { ok: false, error: "policy-assignment-forbidden" }
      }
      const protectedAssignment = state.uiNamespaces.some(
        (namespace) =>
          namespace.administratorRoleId === assignment.targetId &&
          namespace.administratorAccessPolicyId === assignment.accessPolicyId,
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
        ...createEntityBase(),
      }
      updateState((current) => ({
        ...current,
        accessPolicies: [...current.accessPolicies, policy],
      }))
      return { ok: true, value: policy }
    },

    updateAccessPolicy: async (id, input, requesterId) => {
      await Promise.resolve()
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
            policy.id !== id &&
            policy.name.toLocaleLowerCase() === normalizedName,
        )
      ) {
        return { ok: false, error: "policy-name-exists" }
      }
      const referenceError = accessPolicyReferenceError(parsed.data, state)
      if (referenceError) return { ok: false, error: referenceError }
      const impact = resolveAccessPolicyUpdateImpact(
        state,
        existing,
        parsed.data,
      )
      const policyChanged =
        impact.nameChanged ||
        impact.descriptionChanged ||
        impact.effectChanged ||
        impact.addedResources.length > 0 ||
        impact.removedResources.length > 0
      const policy: AccessPolicy = { ...existing, ...parsed.data }
      const notifications = policyChanged
        ? impact.affectedUserIds.map((userId) => ({
            userId,
            event: "access-policy-updated" as const,
            targetType: "access-policy" as const,
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
      const policy: AccessPolicy = { ...existing, status: "inactive" }
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
