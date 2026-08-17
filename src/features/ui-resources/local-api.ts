import { accessPolicyEffects } from "@/features/access-policies/model"
import { accessPolicyResourceTypes } from "@/features/access-policies/model"
import { accessPolicyAssignmentTargets } from "@/features/access-policies/model"
import { entityStatuses } from "@/domain/common"
import { canManageNamespace } from "@/auth/ui-resource-access"
import { hasUiResourcePolicyAccess } from "@/auth/ui-resource-policy-access"
import { hasEffectiveAccessPolicyResource } from "@/features/access-policies/access-policy-assignment"
import { isAccessPolicyEffective } from "@/features/access-policies/access-policy-status"
import { uiResourceKeys } from "@/config/menu-registry"
import type {
  AccessPolicy,
  AccessPolicyAssignment,
  AccessPolicyResource,
} from "@/features/access-policies/model"
import {
  accessPolicyManagementTypes,
  accessPolicyTypes,
} from "@/features/access-policies/model"
import type { UiResourceApi } from "@/features/ui-resources/api"
import {
  entityIdListSchema,
  entityIdSchema,
  entityStatusSchema,
} from "@/domain/common"
import {
  createEntityBase,
  createRecordBase,
  type BackofficeStateUpdater,
} from "@/application/api/local-state"
import type { BackofficeState } from "@/application/state/model"
import { uiResourceManagerUiResourceKeys } from "@/config/system-ui-access"
import {
  namespaceInputSchema,
  uiResourceImportInputSchema,
  type Namespace,
  type UiResource,
  type UiResourceSyncHistory,
} from "@/features/ui-resources/model"
import { previewUiResourceSync } from "@/features/ui-resources/ui-resource-sync"

export function createLocalUiResourceApi(
  state: BackofficeState,
  updateState: BackofficeStateUpdater,
): UiResourceApi {
  return {
    importUiResources: async (input, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.uiResources.list.actions.importUiResources,
        ) ||
        !hasEffectiveAccessPolicyResource(state, requesterId, {
          type: accessPolicyResourceTypes.endpoint,
          id: state.systemReferences.serviceEndpointIds.importUiResources,
        })
      ) {
        return { ok: false, error: "ui-resource-import-forbidden" }
      }
      const parsed = uiResourceImportInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      const preview = previewUiResourceSync(state, parsed.data.manifest)
      if (!preview.ok) return preview
      if (!canManageNamespace(state, requesterId, preview.value.namespace.id)) {
        return { ok: false, error: "ui-resource-import-forbidden" }
      }
      const currentResourcesByKey = new Map(
        [...preview.value.updated, ...preview.value.restored].map(
          ({ current }) => [current.key, current],
        ),
      )
      const importedResources = preview.value.manifest.resources.map(
        (resource): UiResource => {
          const current = currentResourcesByKey.get(resource.key)
          return current
            ? { ...current, ...resource, orphanedAt: null }
            : {
                ...resource,
                namespaceId: preview.value.namespace.id,
                status: entityStatuses.active,
                orphanedAt: null,
                ...createRecordBase(),
              }
        },
      )
      const synchronizedAt = new Date().toISOString()
      const orphanedResources = preview.value.orphaned.map((resource) => ({
        ...resource,
        orphanedAt: resource.orphanedAt ?? synchronizedAt,
      }))
      const history: UiResourceSyncHistory = {
        id: crypto.randomUUID(),
        namespaceId: preview.value.namespace.id,
        synchronizedAt,
        synchronizedByUserId: requesterId,
        grantManagerAccess: parsed.data.grantManagerAccess,
        addedCount: preview.value.added.length,
        updatedCount: preview.value.updated.length,
        restoredCount: preview.value.restored.length,
        orphanedCount: orphanedResources.length,
        resources: structuredClone([
          ...importedResources,
          ...orphanedResources,
        ]),
      }
      const managerPolicy = state.accessPolicies.find(
        (policy) =>
          policy.id === preview.value.namespace.managerAccessPolicyId &&
          policy.effect === accessPolicyEffects.allow,
      )
      const hasManagerAssignment =
        managerPolicy !== undefined &&
        state.accessPolicyAssignments.some(
          (assignment) =>
            assignment.accessPolicyId === managerPolicy.id &&
            assignment.targetType === accessPolicyAssignmentTargets.role &&
            assignment.targetId === preview.value.namespace.managerRoleId,
        )
      if (!managerPolicy || !hasManagerAssignment) {
        return { ok: false, error: "ui-resource-not-found" }
      }
      updateState((current) => ({
        ...current,
        namespaces: current.namespaces.map((namespace) =>
          namespace.id === preview.value.namespace.id
            ? { ...namespace, lastSyncedAt: synchronizedAt }
            : namespace,
        ),
        uiResources: [
          ...current.uiResources.filter(
            (resource) => resource.namespaceId !== preview.value.namespace.id,
          ),
          ...importedResources,
          ...orphanedResources,
        ],
        accessPolicies: current.accessPolicies.map((policy) => {
          if (policy.id !== managerPolicy.id) return policy
          const currentNamespaceResourceIds = new Set(
            current.uiResources
              .filter(
                (resource) =>
                  resource.namespaceId === preview.value.namespace.id,
              )
              .map((resource) => resource.id),
          )
          const importedResourceIds = new Set(
            importedResources.map((resource) => resource.id),
          )
          const otherManagerPolicyIds = new Set(
            current.accessPolicyAssignments
              .filter(
                (assignment) =>
                  assignment.accessPolicyId !== policy.id &&
                  assignment.targetType ===
                    accessPolicyAssignmentTargets.role &&
                  assignment.targetId === preview.value.namespace.managerRoleId,
              )
              .map((assignment) => assignment.accessPolicyId),
          )
          const grantedByOtherPolicies = new Set(
            current.accessPolicies
              .filter(
                (candidate) =>
                  isAccessPolicyEffective(candidate) &&
                  candidate.effect === accessPolicyEffects.allow &&
                  otherManagerPolicyIds.has(candidate.id),
              )
              .flatMap((candidate) =>
                candidate.resources.flatMap((resource) =>
                  resource.type === accessPolicyResourceTypes.uiResource
                    ? [resource.id]
                    : [],
                ),
              ),
          )
          const preservedResources = policy.resources.filter(
            (resource) =>
              resource.type !== accessPolicyResourceTypes.uiResource ||
              !currentNamespaceResourceIds.has(resource.id),
          )
          const managerResources = parsed.data.grantManagerAccess
            ? importedResources.flatMap((resource) =>
                grantedByOtherPolicies.has(resource.id)
                  ? []
                  : ([
                      {
                        type: accessPolicyResourceTypes.uiResource,
                        id: resource.id,
                      },
                    ] satisfies AccessPolicyResource[]),
              )
            : policy.resources.filter(
                (resource) =>
                  resource.type === accessPolicyResourceTypes.uiResource &&
                  currentNamespaceResourceIds.has(resource.id) &&
                  importedResourceIds.has(resource.id),
              )
          return {
            ...policy,
            status: entityStatuses.active,
            resources: [...preservedResources, ...managerResources],
          }
        }),
        uiResourceSyncHistories: [...current.uiResourceSyncHistories, history],
      }))
      return {
        ok: true,
        value: {
          namespaceId: preview.value.namespace.id,
          synchronizedAt,
          addedCount: preview.value.added.length,
          updatedCount: preview.value.updated.length,
          restoredCount: preview.value.restored.length,
          orphanedCount: orphanedResources.length,
          managerAccessUpdated: parsed.data.grantManagerAccess,
          resources: importedResources,
          orphanedResources,
        },
      }
    },

    deleteOrphanedUiResources: async (resourceIds, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.uiResources.list.actions.deleteUiResources,
        )
      ) {
        return { ok: false, error: "ui-resource-delete-forbidden" }
      }
      const parsed = entityIdListSchema.safeParse(resourceIds)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      const resourceIdSet = new Set(parsed.data)
      const resources = state.uiResources.filter((resource) =>
        resourceIdSet.has(resource.id),
      )
      if (
        resources.length !== parsed.data.length ||
        resources.some(
          (resource) =>
            resource.orphanedAt === null ||
            !canManageNamespace(state, requesterId, resource.namespaceId),
        )
      ) {
        return resources.some(
          (resource) =>
            !canManageNamespace(state, requesterId, resource.namespaceId),
        )
          ? { ok: false, error: "ui-resource-delete-forbidden" }
          : { ok: false, error: "invalid-input" }
      }
      const resourceKeySet = new Set(
        resources.map(
          (resource) => `${resource.namespaceId}\u0000${resource.key}`,
        ),
      )
      if (
        state.accessPolicies.some((policy) =>
          policy.resources.some(
            (resource) =>
              resource.type === accessPolicyResourceTypes.uiResource &&
              resourceIdSet.has(resource.id),
          ),
        ) ||
        state.uiResources.some(
          (resource) =>
            !resourceIdSet.has(resource.id) &&
            resource.parentKey !== null &&
            resourceKeySet.has(
              `${resource.namespaceId}\u0000${resource.parentKey}`,
            ),
        )
      ) {
        return { ok: false, error: "protected-relationship" }
      }
      updateState((current) => ({
        ...current,
        uiResources: current.uiResources.filter(
          (resource) => !resourceIdSet.has(resource.id),
        ),
      }))
      return { ok: true, value: resources }
    },

    setUiResourceStatus: async (resourceId, status, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.uiResources.list.actions.changeUiResourceStatus,
        )
      ) {
        return { ok: false, error: "ui-resource-status-forbidden" }
      }
      const parsedResourceId = entityIdSchema.safeParse(resourceId)
      const parsedStatus = entityStatusSchema.safeParse(status)
      if (!parsedResourceId.success || !parsedStatus.success) {
        return { ok: false, error: "invalid-input" }
      }
      const resource = state.uiResources.find(
        (candidate) => candidate.id === parsedResourceId.data,
      )
      if (!resource) return { ok: false, error: "ui-resource-not-found" }
      if (
        resource.orphanedAt !== null ||
        !canManageNamespace(state, requesterId, resource.namespaceId)
      ) {
        return resource.orphanedAt !== null
          ? { ok: false, error: "invalid-input" }
          : { ok: false, error: "ui-resource-status-forbidden" }
      }
      const updatedResource = { ...resource, status: parsedStatus.data }
      updateState((current) => ({
        ...current,
        uiResources: current.uiResources.map((candidate) =>
          candidate.id === updatedResource.id ? updatedResource : candidate,
        ),
      }))
      return { ok: true, value: updatedResource }
    },

    createNamespace: async (input, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.namespaces.list.actions.createNamespace,
        )
      ) {
        return { ok: false, error: "namespace-operation-forbidden" }
      }
      const parsed = namespaceInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (!state.roles.some((role) => role.id === parsed.data.managerRoleId)) {
        return { ok: false, error: "role-not-found" }
      }
      if (
        state.namespaces.some((namespace) => namespace.key === parsed.data.key)
      ) {
        return { ok: false, error: "namespace-key-exists" }
      }
      if (
        state.namespaces.some(
          (namespace) =>
            namespace.name.toLocaleLowerCase() ===
            parsed.data.name.toLocaleLowerCase(),
        )
      ) {
        return { ok: false, error: "namespace-name-exists" }
      }
      const namespaceBase = createEntityBase()
      const managementResources: AccessPolicyResource[] = [
        {
          type: accessPolicyResourceTypes.endpoint,
          id: state.systemReferences.serviceEndpointIds.importUiResources,
        },
      ]
      if (
        !state.serviceEndpoints.some(
          (endpoint) =>
            endpoint.id ===
            state.systemReferences.serviceEndpointIds.importUiResources,
        )
      ) {
        return { ok: false, error: "endpoint-not-found" }
      }
      for (const key of uiResourceManagerUiResourceKeys) {
        const resource = state.uiResources.find(
          (candidate) =>
            candidate.namespaceId ===
              state.systemReferences.namespaceIds.backoffice &&
            candidate.key === key &&
            candidate.orphanedAt === null,
        )
        if (!resource) return { ok: false, error: "ui-resource-not-found" }
        managementResources.push({
          type: accessPolicyResourceTypes.uiResource,
          id: resource.id,
        })
      }
      const managerPolicyBase = createRecordBase()
      const namespace: Namespace = {
        ...parsed.data,
        ...namespaceBase,
        managerAccessPolicyId: managerPolicyBase.id,
        lastSyncedAt: null,
      }
      const managerPolicy: AccessPolicy = {
        ...managerPolicyBase,
        name: `${namespace.name} UI 리소스 관리 접근`,
        description: `${namespace.name} 관리 역할에 UI 리소스 관리 액션과 동기화 API 접근을 허용하고 동기화 시 선택된 UI 리소스를 추가합니다.`,
        type: accessPolicyTypes.accessGrant,
        managementType: accessPolicyManagementTypes.systemManaged,
        effect: accessPolicyEffects.allow,
        resources: managementResources,
        status: entityStatuses.active,
      }
      const managerAssignment: AccessPolicyAssignment = {
        ...createRecordBase(),
        accessPolicyId: managerPolicy.id,
        targetType: accessPolicyAssignmentTargets.role,
        targetId: namespace.managerRoleId,
        expiresAt: null,
      }
      updateState((current) => ({
        ...current,
        namespaces: [...current.namespaces, namespace],
        accessPolicies: [...current.accessPolicies, managerPolicy],
        accessPolicyAssignments: [
          ...current.accessPolicyAssignments,
          managerAssignment,
        ],
      }))
      return { ok: true, value: namespace }
    },

    updateNamespaceManager: async (namespaceId, managerRoleId, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.namespaces.detail.actions.changeNamespaceManager,
        )
      ) {
        return { ok: false, error: "namespace-operation-forbidden" }
      }
      if (
        !entityIdSchema.safeParse(namespaceId).success ||
        !entityIdSchema.safeParse(managerRoleId).success
      ) {
        return { ok: false, error: "invalid-input" }
      }
      const namespace = state.namespaces.find(
        (candidate) => candidate.id === namespaceId,
      )
      if (!namespace) return { ok: false, error: "namespace-not-found" }
      if (!state.roles.some((role) => role.id === managerRoleId)) {
        return { ok: false, error: "role-not-found" }
      }
      const assignment = state.accessPolicyAssignments.find(
        (candidate) =>
          candidate.accessPolicyId === namespace.managerAccessPolicyId &&
          candidate.targetType === accessPolicyAssignmentTargets.role &&
          candidate.targetId === namespace.managerRoleId,
      )
      if (!assignment) return { ok: false, error: "protected-relationship" }
      const updated = { ...namespace, managerRoleId }
      updateState((current) => ({
        ...current,
        namespaces: current.namespaces.map((candidate) =>
          candidate.id === namespaceId ? updated : candidate,
        ),
        accessPolicyAssignments: current.accessPolicyAssignments.map(
          (candidate) =>
            candidate.id === assignment.id
              ? { ...candidate, targetId: managerRoleId }
              : candidate,
        ),
      }))
      return { ok: true, value: updated }
    },

    retireNamespace: async (namespaceId, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.namespaces.detail.actions.retireNamespace,
        )
      ) {
        return { ok: false, error: "namespace-operation-forbidden" }
      }
      if (!entityIdSchema.safeParse(namespaceId).success) {
        return { ok: false, error: "invalid-input" }
      }
      const namespace = state.namespaces.find(
        (candidate) => candidate.id === namespaceId,
      )
      if (!namespace) return { ok: false, error: "namespace-not-found" }
      if (namespace.id === state.systemReferences.namespaceIds.backoffice) {
        return { ok: false, error: "protected-relationship" }
      }
      const updated: Namespace = {
        ...namespace,
        status: entityStatuses.inactive,
      }
      updateState((current) => ({
        ...current,
        namespaces: current.namespaces.map((candidate) =>
          candidate.id === namespaceId ? updated : candidate,
        ),
        uiResources: current.uiResources.map((resource) =>
          resource.namespaceId === namespaceId
            ? { ...resource, status: entityStatuses.inactive }
            : resource,
        ),
      }))
      return { ok: true, value: updated }
    },

    restoreUiResourceSync: async (historyId, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.uiResources.list.actions.restoreUiResourceSync,
        )
      ) {
        return { ok: false, error: "ui-resource-import-forbidden" }
      }
      if (!entityIdSchema.safeParse(historyId).success) {
        return { ok: false, error: "invalid-input" }
      }
      const source = state.uiResourceSyncHistories.find(
        (history) => history.id === historyId,
      )
      if (!source) return { ok: false, error: "ui-resource-not-found" }
      const namespace = state.namespaces.find(
        (candidate) => candidate.id === source.namespaceId,
      )
      if (
        namespace?.status !== entityStatuses.active ||
        !canManageNamespace(state, requesterId, namespace.id)
      ) {
        return { ok: false, error: "ui-resource-import-forbidden" }
      }
      const synchronizedAt = new Date().toISOString()
      const targetSnapshot = source.resources.filter(
        (resource) => resource.orphanedAt === null,
      )
      const targetKeys = new Set(targetSnapshot.map((resource) => resource.key))
      const currentResources = state.uiResources.filter(
        (resource) => resource.namespaceId === namespace.id,
      )
      const currentByKey = new Map(
        currentResources.map((resource) => [resource.key, resource]),
      )
      const restoredResources = targetSnapshot.map((resource) => {
        const current = currentByKey.get(resource.key)
        return {
          ...resource,
          id: current?.id ?? resource.id,
          namespaceId: namespace.id,
          orphanedAt: null,
        }
      })
      const orphanedResources = currentResources
        .filter((resource) => !targetKeys.has(resource.key))
        .map((resource) => ({
          ...resource,
          orphanedAt: resource.orphanedAt ?? synchronizedAt,
        }))
      const restoredFromOrphan = restoredResources.filter(
        (resource) => currentByKey.get(resource.key)?.orphanedAt !== null,
      ).length
      const addedCount = restoredResources.filter(
        (resource) => !currentByKey.has(resource.key),
      ).length
      const history: UiResourceSyncHistory = {
        id: crypto.randomUUID(),
        namespaceId: namespace.id,
        synchronizedAt,
        synchronizedByUserId: requesterId,
        grantManagerAccess: false,
        addedCount,
        updatedCount:
          restoredResources.length - addedCount - restoredFromOrphan,
        restoredCount: restoredFromOrphan,
        orphanedCount: orphanedResources.length,
        resources: structuredClone([
          ...restoredResources,
          ...orphanedResources,
        ]),
      }
      updateState((current) => ({
        ...current,
        namespaces: current.namespaces.map((candidate) =>
          candidate.id === namespace.id
            ? { ...candidate, lastSyncedAt: synchronizedAt }
            : candidate,
        ),
        uiResources: [
          ...current.uiResources.filter(
            (resource) => resource.namespaceId !== namespace.id,
          ),
          ...restoredResources,
          ...orphanedResources,
        ],
        uiResourceSyncHistories: [...current.uiResourceSyncHistories, history],
      }))
      return {
        ok: true,
        value: {
          namespaceId: namespace.id,
          synchronizedAt,
          addedCount,
          updatedCount: history.updatedCount,
          restoredCount: restoredFromOrphan,
          orphanedCount: orphanedResources.length,
          managerAccessUpdated: false,
          resources: restoredResources,
          orphanedResources,
          restoredFromHistoryId: source.id,
        },
      }
    },
  }
}
