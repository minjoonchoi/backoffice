import { describe, expect, it } from "vitest"

import { localFixture } from "@/mocks/fixture"
import { resolveUiResourceVisibilities } from "@/features/ui-resources/ui-resource-visibility"

function resourceByKey(key: string) {
  const resource = localFixture.uiResources.find(
    (candidate) => candidate.key === key,
  )
  if (!resource) throw new Error(`UI resource fixture not found: ${key}`)
  return resource
}

describe("UI resource visibility", () => {
  it("hides active descendants while an ancestor is inactive", () => {
    const resources = structuredClone(localFixture.uiResources)
    const root = resources.find((resource) => resource.key === "services")
    const child = resources.find(
      (resource) => resource.key === "services:list:createService",
    )
    if (!root || !child) throw new Error("UI resource fixtures are missing")
    root.status = "inactive"

    const visibilities = resolveUiResourceVisibilities(resources)

    expect(visibilities.get(root.id)).toBe("inactive")
    expect(child.status).toBe("active")
    expect(visibilities.get(child.id)).toBe("ancestor-inactive")
  })

  it("restores active descendants when their ancestor is reactivated", () => {
    const resources = structuredClone(localFixture.uiResources)
    const root = resources.find((resource) => resource.key === "services")
    const child = resources.find(
      (resource) => resource.key === "services:list:createService",
    )
    if (!root || !child) throw new Error("UI resource fixtures are missing")
    root.status = "inactive"
    expect(resolveUiResourceVisibilities(resources).get(child.id)).toBe(
      "ancestor-inactive",
    )

    root.status = "active"

    expect(resolveUiResourceVisibilities(resources).get(child.id)).toBe(
      "visible",
    )
  })

  it("keeps individual inactive and orphan states distinct", () => {
    const resources = structuredClone(localFixture.uiResources)
    const inactive = resources.find(
      (resource) => resource.id === resourceByKey("services:list").id,
    )
    const orphaned = resources.find(
      (resource) =>
        resource.id === resourceByKey("services:list:createService").id,
    )
    if (!inactive || !orphaned) {
      throw new Error("UI resource fixtures are missing")
    }
    inactive.status = "inactive"
    orphaned.orphanedAt = "2026-08-11T01:00:00.000Z"

    const visibilities = resolveUiResourceVisibilities(resources)

    expect(visibilities.get(inactive.id)).toBe("inactive")
    expect(visibilities.get(orphaned.id)).toBe("orphaned")
  })
})
