import { describe, expect, it } from "vitest"

import { localFixture } from "@/mocks/fixture"
import { defaultUiNamespace } from "@/mocks/system-fixture"
import { previewUiResourceSync } from "@/features/ui-resources/ui-resource-sync"

describe("UI resource synchronization preview", () => {
  it("recalculates omitted existing resources as orphaned", () => {
    const root = localFixture.uiResources.find(
      (resource) => resource.key === "services",
    )
    const child = localFixture.uiResources.find(
      (resource) => resource.key === "services:list",
    )
    if (!root || !child) throw new Error("UI resource fixtures are missing")

    const fullPreview = previewUiResourceSync(localFixture, {
      version: 1,
      namespaceKey: defaultUiNamespace.key,
      resources: [
        {
          key: root.key,
          parentKey: root.parentKey,
          type: root.type,
          name: root.name,
          description: root.description,
        },
        {
          key: child.key,
          parentKey: child.parentKey,
          type: child.type,
          name: child.name,
          description: child.description,
        },
      ],
    })
    expect(fullPreview.ok).toBe(true)
    if (!fullPreview.ok) return
    expect(fullPreview.value.updated).toHaveLength(2)
    expect(fullPreview.value.orphaned).not.toContainEqual(
      expect.objectContaining({ id: child.id }),
    )

    const selectedPreview = previewUiResourceSync(localFixture, {
      version: 1,
      namespaceKey: defaultUiNamespace.key,
      resources: [fullPreview.value.manifest.resources[0]],
    })
    expect(selectedPreview.ok).toBe(true)
    if (!selectedPreview.ok) return
    expect(selectedPreview.value.orphaned).toContainEqual(
      expect.objectContaining({ id: child.id, key: child.key }),
    )
  })

  it("separates resources restored from orphaned status", () => {
    const state = structuredClone(localFixture)
    const root = state.uiResources.find(
      (resource) => resource.key === "services",
    )
    const child = state.uiResources.find(
      (resource) => resource.key === "services:list",
    )
    if (!root || !child) throw new Error("UI resource fixtures are missing")
    child.orphanedAt = "2026-08-10T00:00:00.000Z"

    const preview = previewUiResourceSync(state, {
      version: 1,
      namespaceKey: defaultUiNamespace.key,
      resources: [
        {
          key: root.key,
          parentKey: root.parentKey,
          type: root.type,
          name: root.name,
          description: root.description,
        },
        {
          key: child.key,
          parentKey: child.parentKey,
          type: child.type,
          name: child.name,
          description: child.description,
        },
      ],
    })

    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(preview.value.updated.map(({ current }) => current.id)).toContain(
      root.id,
    )
    expect(
      preview.value.updated.map(({ current }) => current.id),
    ).not.toContain(child.id)
    expect(preview.value.restored).toHaveLength(1)
    expect(preview.value.restored[0]?.current.id).toBe(child.id)
    expect(preview.value.restored[0]?.current.orphanedAt).toBe(child.orphanedAt)
    expect(preview.value.restored[0]?.next.key).toBe(child.key)
    expect(preview.value.orphaned.map(({ id }) => id)).not.toContain(child.id)
  })
})
