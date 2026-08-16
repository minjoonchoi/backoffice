import type { UiResource } from "@/features/ui-resources/model"
import { entityStatuses } from "@/domain/common"

export const uiResourceVisibilityValues = {
  visible: "visible",
  inactive: "inactive",
  ancestorInactive: "ancestor-inactive",
  orphaned: "orphaned",
} as const
export type UiResourceVisibility =
  (typeof uiResourceVisibilityValues)[keyof typeof uiResourceVisibilityValues]

function resourceIndexKey(resource: Pick<UiResource, "namespaceId" | "key">) {
  return `${resource.namespaceId}\u0000${resource.key}`
}

export function resolveUiResourceVisibilities(
  resources: readonly UiResource[],
): ReadonlyMap<string, UiResourceVisibility> {
  const resourcesByKey = new Map(
    resources.map((resource) => [resourceIndexKey(resource), resource]),
  )
  const visibilities = new Map<string, UiResourceVisibility>()

  function resolve(
    resource: UiResource,
    visiting: ReadonlySet<string>,
  ): UiResourceVisibility {
    const resolved = visibilities.get(resource.id)
    if (resolved) return resolved
    if (resource.orphanedAt !== null) {
      visibilities.set(resource.id, uiResourceVisibilityValues.orphaned)
      return uiResourceVisibilityValues.orphaned
    }
    if (resource.status === entityStatuses.inactive) {
      visibilities.set(resource.id, uiResourceVisibilityValues.inactive)
      return uiResourceVisibilityValues.inactive
    }
    if (resource.parentKey === null) {
      visibilities.set(resource.id, uiResourceVisibilityValues.visible)
      return uiResourceVisibilityValues.visible
    }
    if (visiting.has(resource.id)) {
      return uiResourceVisibilityValues.ancestorInactive
    }

    const parent = resourcesByKey.get(
      resourceIndexKey({
        namespaceId: resource.namespaceId,
        key: resource.parentKey,
      }),
    )
    if (!parent) {
      visibilities.set(resource.id, uiResourceVisibilityValues.ancestorInactive)
      return uiResourceVisibilityValues.ancestorInactive
    }

    const nextVisiting = new Set(visiting)
    nextVisiting.add(resource.id)
    const parentVisibility = resolve(parent, nextVisiting)
    const visibility =
      parentVisibility === uiResourceVisibilityValues.visible
        ? uiResourceVisibilityValues.visible
        : uiResourceVisibilityValues.ancestorInactive
    visibilities.set(resource.id, visibility)
    return visibility
  }

  for (const resource of resources) {
    resolve(resource, new Set())
  }
  return visibilities
}
