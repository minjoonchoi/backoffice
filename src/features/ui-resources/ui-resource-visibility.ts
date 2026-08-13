import type { UiResource } from "@/features/ui-resources/model"

export type UiResourceVisibility =
  "visible" | "inactive" | "ancestor-inactive" | "orphaned"

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
      visibilities.set(resource.id, "orphaned")
      return "orphaned"
    }
    if (resource.status === "inactive") {
      visibilities.set(resource.id, "inactive")
      return "inactive"
    }
    if (resource.parentKey === null) {
      visibilities.set(resource.id, "visible")
      return "visible"
    }
    if (visiting.has(resource.id)) {
      return "ancestor-inactive"
    }

    const parent = resourcesByKey.get(
      resourceIndexKey({
        namespaceId: resource.namespaceId,
        key: resource.parentKey,
      }),
    )
    if (!parent) {
      visibilities.set(resource.id, "ancestor-inactive")
      return "ancestor-inactive"
    }

    const nextVisiting = new Set(visiting)
    nextVisiting.add(resource.id)
    const parentVisibility = resolve(parent, nextVisiting)
    const visibility =
      parentVisibility === "visible" ? "visible" : "ancestor-inactive"
    visibilities.set(resource.id, visibility)
    return visibility
  }

  for (const resource of resources) {
    resolve(resource, new Set())
  }
  return visibilities
}
