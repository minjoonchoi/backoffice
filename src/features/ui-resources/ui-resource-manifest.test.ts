import { describe, expect, it } from "vitest"
import { stringify } from "yaml"

import { uiResourceManifest } from "@/config/menu-registry"
import {
  getUiResourceParentKey,
  parseUiResourceManifestText,
  uiResourceManifestSchema,
} from "@/features/ui-resources/ui-resource-manifest"

describe("UI Resource manifest", () => {
  it("validates the code-owned registry and its JSON or YAML output", () => {
    expect(uiResourceManifestSchema.safeParse(uiResourceManifest).success).toBe(
      true,
    )
    expect(
      uiResourceManifestSchema.safeParse(
        parseUiResourceManifestText(JSON.stringify(uiResourceManifest), "json"),
      ).success,
    ).toBe(true)
    expect(
      uiResourceManifestSchema.safeParse(
        parseUiResourceManifestText(stringify(uiResourceManifest), "yaml"),
      ).success,
    ).toBe(true)
  })

  it("derives the immediate parent from colon-delimited depth", () => {
    expect(getUiResourceParentKey("services")).toBeNull()
    expect(getUiResourceParentKey("services:list:createService")).toBe(
      "services:list",
    )
    expect(getUiResourceParentKey("services:form:submit")).toBe("services:form")
  })

  it("accepts only lowerCamelCase resource depths and rejects unknown fields", () => {
    const resource = uiResourceManifest.resources[0]
    expect(resource).toBeDefined()
    if (!resource) return
    expect(
      uiResourceManifestSchema.safeParse({
        version: 1,
        namespaceKey: "access-governance",
        resources: [{ ...resource, key: "ui-resources:read" }],
      }).success,
    ).toBe(false)
    expect(
      uiResourceManifestSchema.safeParse({
        version: 1,
        namespaceKey: "access-governance",
        resources: [{ ...resource, endpointIds: [] }],
      }).success,
    ).toBe(false)
  })

  it("rejects duplicate keys and malformed YAML", () => {
    const resource = uiResourceManifest.resources[0]
    expect(resource).toBeDefined()
    if (!resource) return
    expect(
      uiResourceManifestSchema.safeParse({
        version: 1,
        resources: [resource, resource],
      }).success,
    ).toBe(false)
    expect(() =>
      parseUiResourceManifestText("version: 1\nversion: 1", "yaml"),
    ).toThrow()
  })
})
