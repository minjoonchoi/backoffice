import { canManageUiNamespace } from "@/auth/ui-resource-access"
import { hasUiResourcePolicyAccess } from "@/auth/ui-resource-policy-access"
import { hasEffectiveAccessPolicyResource } from "@/features/access-policies/access-policy-assignment"
import { uiResourceKeys } from "@/config/menu-registry"
import type {
  AccessPolicy,
  AccessPolicyAssignment,
  AccessPolicyResource,
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
  uiNamespaceInputSchema,
  uiResourceImportInputSchema,
  type UiNamespace,
  type UiResource,
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
          type: "endpoint",
          id: state.systemReferences.serviceEndpointIds.importUiResources,
        })
      ) {
        return { ok: false, error: "ui-resource-import-forbidden" }
      }
      const parsed = uiResourceImportInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      const preview = previewUiResourceSync(state, parsed.data.manifest)
      if (!preview.ok) return preview
      if (
        !canManageUiNamespace(state, requesterId, preview.value.namespace.id)
      ) {
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
                status: "active",
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
      const administratorPolicy = state.accessPolicies.find(
        (policy) =>
          policy.id === preview.value.namespace.administratorAccessPolicyId &&
          policy.effect === "allow",
      )
      const hasAdministratorAssignment =
        administratorPolicy !== undefined &&
        state.accessPolicyAssignments.some(
          (assignment) =>
            assignment.accessPolicyId === administratorPolicy.id &&
            assignment.targetType === "role" &&
            assignment.targetId === preview.value.namespace.administratorRoleId,
        )
      if (!administratorPolicy || !hasAdministratorAssignment) {
        return { ok: false, error: "ui-resource-not-found" }
      }
      updateState((current) => ({
        ...current,
        uiNamespaces: current.uiNamespaces.map((namespace) =>
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
          if (policy.id !== administratorPolicy.id) return policy
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
          const otherAdministratorPolicyIds = new Set(
            current.accessPolicyAssignments
              .filter(
                (assignment) =>
                  assignment.accessPolicyId !== policy.id &&
                  assignment.targetType === "role" &&
                  assignment.targetId ===
                    preview.value.namespace.administratorRoleId,
              )
              .map((assignment) => assignment.accessPolicyId),
          )
          const grantedByOtherPolicies = new Set(
            current.accessPolicies
              .filter(
                (candidate) =>
                  candidate.status === "active" &&
                  candidate.effect === "allow" &&
                  otherAdministratorPolicyIds.has(candidate.id),
              )
              .flatMap((candidate) =>
                candidate.resources.flatMap((resource) =>
                  resource.type === "ui-resource" ? [resource.id] : [],
                ),
              ),
          )
          const preservedResources = policy.resources.filter(
            (resource) =>
              resource.type !== "ui-resource" ||
              !currentNamespaceResourceIds.has(resource.id),
          )
          const administratorResources = parsed.data.grantAdministratorAccess
            ? importedResources.flatMap((resource) =>
                grantedByOtherPolicies.has(resource.id)
                  ? []
                  : ([
                      {
                        type: "ui-resource",
                        id: resource.id,
                      },
                    ] satisfies AccessPolicyResource[]),
              )
            : policy.resources.filter(
                (resource) =>
                  resource.type === "ui-resource" &&
                  currentNamespaceResourceIds.has(resource.id) &&
                  importedResourceIds.has(resource.id),
              )
          return {
            ...policy,
            status: "active",
            resources: [...preservedResources, ...administratorResources],
          }
        }),
      }))
      return {
        ok: true,
        value: {
          namespaceId: preview.value.namespace.id,
          synchronizedAt,
          addedCount: preview.value.added.length,
          updatedCount:
            preview.value.updated.length + preview.value.restored.length,
          orphanedCount: orphanedResources.length,
          administratorAccessUpdated: parsed.data.grantAdministratorAccess,
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
            !canManageUiNamespace(state, requesterId, resource.namespaceId),
        )
      ) {
        return resources.some(
          (resource) =>
            !canManageUiNamespace(state, requesterId, resource.namespaceId),
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
              resource.type === "ui-resource" && resourceIdSet.has(resource.id),
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
        !canManageUiNamespace(state, requesterId, resource.namespaceId)
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

    createUiNamespace: async (input, requesterId) => {
      await Promise.resolve()
      if (
        !hasUiResourcePolicyAccess(
          state,
          requesterId,
          uiResourceKeys.namespaces.list.actions.createNamespace,
        )
      ) {
        return { ok: false, error: "ui-namespace-operation-forbidden" }
      }
      const parsed = uiNamespaceInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (
        !state.roles.some((role) => role.id === parsed.data.administratorRoleId)
      ) {
        return { ok: false, error: "role-not-found" }
      }
      if (
        state.uiNamespaces.some(
          (namespace) => namespace.key === parsed.data.key,
        )
      ) {
        return { ok: false, error: "ui-namespace-key-exists" }
      }
      if (
        state.uiNamespaces.some(
          (namespace) =>
            namespace.name.toLocaleLowerCase() ===
            parsed.data.name.toLocaleLowerCase(),
        )
      ) {
        return { ok: false, error: "ui-namespace-name-exists" }
      }
      const namespaceBase = createEntityBase()
      const managementResources: AccessPolicyResource[] = [
        { type: "ui-namespace", id: namespaceBase.id },
        {
          type: "endpoint",
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
              state.systemReferences.uiNamespaceIds.backoffice &&
            candidate.key === key &&
            candidate.orphanedAt === null,
        )
        if (!resource) return { ok: false, error: "ui-resource-not-found" }
        managementResources.push({ type: "ui-resource", id: resource.id })
      }
      const administratorPolicyBase = createRecordBase()
      const namespace: UiNamespace = {
        ...parsed.data,
        ...namespaceBase,
        administratorAccessPolicyId: administratorPolicyBase.id,
        lastSyncedAt: null,
      }
      const administratorPolicy: AccessPolicy = {
        ...administratorPolicyBase,
        name: `${namespace.name} 시스템 관리자 접근`,
        description: `${namespace.name} 시스템 관리자에게 네임스페이스 범위, 동기화 UI 액션과 API 접근을 허용하고 동기화 시 선택된 UI 리소스를 추가합니다.`,
        type: "access-grant",
        effect: "allow",
        resources: managementResources,
        status: "active",
      }
      const administratorAssignment: AccessPolicyAssignment = {
        ...createRecordBase(),
        accessPolicyId: administratorPolicy.id,
        targetType: "role",
        targetId: namespace.administratorRoleId,
      }
      updateState((current) => ({
        ...current,
        uiNamespaces: [...current.uiNamespaces, namespace],
        accessPolicies: [...current.accessPolicies, administratorPolicy],
        accessPolicyAssignments: [
          ...current.accessPolicyAssignments,
          administratorAssignment,
        ],
      }))
      return { ok: true, value: namespace }
    },
  }
}
