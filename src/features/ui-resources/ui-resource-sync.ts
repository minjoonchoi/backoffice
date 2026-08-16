import { entityStatuses } from "@/domain/common"
import type { BackofficeState } from "@/application/state/model"
import type { CommandResult } from "@/domain/common"
import type { Namespace, UiResource } from "@/features/ui-resources/model"
import {
  getUiResourceParentKey,
  uiResourceTypeValues,
  uiResourceManifestSchema,
  type UiResourceManifest,
  type UiResourceManifestResource,
} from "@/features/ui-resources/ui-resource-manifest"

type UiResourceSyncState = Pick<BackofficeState, "namespaces" | "uiResources">

export type UiResourceSyncPreview = {
  namespace: Namespace
  manifest: UiResourceManifest
  added: UiResourceManifestResource[]
  updated: {
    current: UiResource
    next: UiResourceManifestResource
  }[]
  restored: {
    current: UiResource
    next: UiResourceManifestResource
  }[]
  orphaned: UiResource[]
}

export function previewUiResourceSync(
  state: UiResourceSyncState,
  input: unknown,
): CommandResult<UiResourceSyncPreview> {
  const parsed = uiResourceManifestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid-input" }

  const namespace = state.namespaces.find(
    (item) =>
      item.key === parsed.data.namespaceKey &&
      item.status === entityStatuses.active,
  )
  if (!namespace) return { ok: false, error: "namespace-not-found" }

  const availableKeys = new Set(
    parsed.data.resources.map((resource) => resource.key),
  )
  for (const resource of parsed.data.resources) {
    const expectedParentKey = getUiResourceParentKey(resource.key)
    if (
      resource.parentKey !== expectedParentKey ||
      (expectedParentKey === null &&
        resource.type !== uiResourceTypeValues.menu) ||
      (expectedParentKey !== null &&
        resource.type === uiResourceTypeValues.menu)
    ) {
      return { ok: false, error: "invalid-input" }
    }
    if (resource.parentKey && !availableKeys.has(resource.parentKey)) {
      return { ok: false, error: "ui-resource-parent-not-found" }
    }
  }

  const currentResources = state.uiResources.filter(
    (resource) => resource.namespaceId === namespace.id,
  )
  const currentResourcesByKey = new Map(
    currentResources.map((resource) => [resource.key, resource]),
  )
  const incomingKeys = new Set(
    parsed.data.resources.map((resource) => resource.key),
  )

  return {
    ok: true,
    value: {
      namespace,
      manifest: parsed.data,
      added: parsed.data.resources.filter(
        (resource) => !currentResourcesByKey.has(resource.key),
      ),
      updated: parsed.data.resources.flatMap((resource) => {
        const current = currentResourcesByKey.get(resource.key)
        return current?.orphanedAt === null ? [{ current, next: resource }] : []
      }),
      restored: parsed.data.resources.flatMap((resource) => {
        const current = currentResourcesByKey.get(resource.key)
        return typeof current?.orphanedAt === "string"
          ? [{ current, next: resource }]
          : []
      }),
      orphaned: currentResources.filter(
        (resource) => !incomingKeys.has(resource.key),
      ),
    },
  }
}
