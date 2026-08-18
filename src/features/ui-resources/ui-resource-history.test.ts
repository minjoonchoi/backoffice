import { describe, expect, it } from "vitest"

import {
  compareManifestWithUiResources,
  compareUiResourceSyncs,
} from "@/features/ui-resources/ui-resource-history"
import type {
  UiResource,
  UiResourceSyncHistory,
} from "@/features/ui-resources/model"

function resource(
  key: string,
  name = key,
  orphanedAt: string | null = null,
): UiResource {
  return {
    id: `id-${key}`,
    namespaceId: "namespace",
    key,
    parentKey: null,
    type: "menu",
    name,
    description: `${name} description`,
    status: "active",
    orphanedAt,
    createdAt: "2026-08-01T00:00:00.000Z",
  }
}

function history(id: string, resources: UiResource[]): UiResourceSyncHistory {
  return {
    id,
    namespaceId: "namespace",
    synchronizedAt: "2026-08-01T00:00:00.000Z",
    synchronizedByUserId: "user",
    grantManagerAccess: false,
    addedCount: 0,
    updatedCount: 0,
    restoredCount: 0,
    orphanedCount: 0,
    resources,
  }
}

describe("UI resource history analysis", () => {
  it("compares additions, removals, changes, and orphan restoration", () => {
    const comparison = compareUiResourceSyncs(
      history("before", [
        resource("removed"),
        resource("changed", "Before"),
        resource("restored", "Restored", "2026-08-01T00:00:00.000Z"),
      ]),
      history("after", [
        resource("added"),
        resource("changed", "After"),
        resource("restored", "Restored"),
      ]),
    )

    expect(comparison).toEqual({
      addedKeys: ["added", "restored"],
      removedKeys: ["removed"],
      changedKeys: ["changed"],
      restoredKeys: ["restored"],
    })
  })

  it("detects code-only, server-only, and changed manifest resources", () => {
    const comparison = compareManifestWithUiResources(
      {
        version: 1,
        namespaceKey: "access-governance",
        resources: [
          {
            key: "codeOnly",
            parentKey: null,
            type: "menu",
            name: "Code",
            description: "Code description",
          },
          {
            key: "changed",
            parentKey: null,
            type: "menu",
            name: "Code changed",
            description: "Changed description",
          },
        ],
      },
      [resource("serverOnly"), resource("changed", "Server changed")],
    )

    expect(comparison).toEqual({
      onlyInCode: ["codeOnly"],
      onlyOnServer: ["serverOnly"],
      changed: ["changed"],
    })
  })
})
