import { describe, expect, it } from "vitest"

import { loadFixture } from "@/mocks/fixture-loader"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { initialBackofficeState } from "@/mocks/system-fixture"

const fixtureSources = import.meta.glob("./fixture.yaml", {
  eager: true,
  import: "default",
  query: "?raw",
})
const fixtureSource = fixtureSources["./fixture.yaml"]
if (typeof fixtureSource !== "string") {
  throw new Error("YAML fixture was not loaded for tests.")
}

describe("YAML fixture loader", () => {
  it("loads local data and composes code-owned system resources", () => {
    const loaded = loadFixture(fixtureSource)

    expect(loaded.defaultUserId).toBe(localDefaultUserId)
    expect(loaded.state).toEqual(localFixture)
    expect(loaded.state.namespaces).toEqual(initialBackofficeState.namespaces)
    expect(loaded.state.uiResources).toEqual(initialBackofficeState.uiResources)
    expect(
      initialBackofficeState.accessPolicies.every((systemPolicy) =>
        loaded.state.accessPolicies.some(
          (policy) => policy.id === systemPolicy.id,
        ),
      ),
    ).toBe(true)
  })

  it("rejects malformed YAML and duplicate keys", () => {
    expect(() => loadFixture("version: 1\nversion: 1\n")).toThrow(SyntaxError)
  })

  it("rejects unknown fields and missing entity references", () => {
    const unknownFieldSource = fixtureSource.replace(
      "version: 1",
      "version: 1\nunknownField: true",
    )
    const missingDefaultUserSource = fixtureSource.replace(
      `defaultUserId: ${localDefaultUserId}`,
      "defaultUserId: 10000000-0000-4000-8000-999999999999",
    )

    expect(() => loadFixture(unknownFieldSource)).toThrow()
    expect(() => loadFixture(missingDefaultUserSource)).toThrow(
      "default user not found",
    )
    expect(() =>
      loadFixture(
        fixtureSource.replace("version: 1", "version: 1\ngroups: []"),
      ),
    ).toThrow()
  })

  it("resolves UI resource keys and rejects unknown keys", () => {
    const uiResourcePolicySource = fixtureSource
      .replace(
        "      - type: endpoint\n        id: 70000000-0000-4000-8000-000000000001",
        "      - type: ui-resource-key\n        key: services:detail:updateService",
      )
      .replace(
        "      - type: endpoint\n        id: 70000000-0000-4000-8000-000000000003",
        "      - type: ui-resource-key\n        key: services:list",
      )
    const loaded = loadFixture(uiResourcePolicySource)
    const updateServiceResource = loaded.state.uiResources.find(
      (resource) => resource.key === "services:detail:updateService",
    )
    const localPolicy = loaded.state.accessPolicies.find(
      (policy) => policy.name === "운영 모니터링 허용",
    )
    const missingKeySource = uiResourcePolicySource.replace(
      "key: services:detail:updateService",
      "key: services:missingAction",
    )

    expect(updateServiceResource).toBeDefined()
    expect(localPolicy?.resources).toContainEqual({
      type: "ui-resource",
      id: updateServiceResource?.id,
    })
    expect(() => loadFixture(missingKeySource)).toThrow(
      "UI resource key not found",
    )
  })
})
