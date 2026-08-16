import type { UiResourceSyncHistory } from "@/features/ui-resources/model"
import type { UiResource } from "@/features/ui-resources/model"
import type { UiResourceManifest } from "@/features/ui-resources/ui-resource-manifest"

export type UiResourceSyncComparison = Readonly<{
  addedKeys: readonly string[]
  removedKeys: readonly string[]
  changedKeys: readonly string[]
  restoredKeys: readonly string[]
}>

function activeResources(history: UiResourceSyncHistory) {
  return new Map(
    history.resources
      .filter((resource) => resource.orphanedAt === null)
      .map((resource) => [resource.key, resource]),
  )
}

export function compareUiResourceSyncs(
  previous: UiResourceSyncHistory,
  current: UiResourceSyncHistory,
): UiResourceSyncComparison {
  const previousResources = activeResources(previous)
  const currentResources = activeResources(current)
  return {
    addedKeys: [...currentResources.keys()]
      .filter((key) => !previousResources.has(key))
      .sort(),
    removedKeys: [...previousResources.keys()]
      .filter((key) => !currentResources.has(key))
      .sort(),
    changedKeys: [...currentResources.entries()]
      .filter(([key, resource]) => {
        const before = previousResources.get(key)
        return Boolean(
          before &&
          (before.name !== resource.name ||
            before.description !== resource.description ||
            before.parentKey !== resource.parentKey ||
            before.type !== resource.type),
        )
      })
      .map(([key]) => key)
      .sort(),
    restoredKeys: current.resources
      .filter(
        (resource) =>
          resource.orphanedAt === null &&
          previous.resources.some(
            (before) =>
              before.key === resource.key && before.orphanedAt !== null,
          ),
      )
      .map((resource) => resource.key)
      .sort(),
  }
}

export function compareManifestWithUiResources(
  manifest: UiResourceManifest,
  resources: readonly UiResource[],
) {
  const manifestKeys = new Set(
    manifest.resources.map((resource) => resource.key),
  )
  const serverResources = new Map(
    resources
      .filter((resource) => resource.orphanedAt === null)
      .map((resource) => [resource.key, resource]),
  )
  return {
    onlyInCode: [...manifestKeys]
      .filter((key) => !serverResources.has(key))
      .sort(),
    onlyOnServer: [...serverResources.keys()]
      .filter((key) => !manifestKeys.has(key))
      .sort(),
    changed: manifest.resources
      .filter((resource) => {
        const server = serverResources.get(resource.key)
        return Boolean(
          server &&
          (server.name !== resource.name ||
            server.description !== resource.description ||
            server.parentKey !== resource.parentKey ||
            server.type !== resource.type),
        )
      })
      .map((resource) => resource.key)
      .sort(),
  }
}
