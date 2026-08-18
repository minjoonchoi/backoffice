import { describe, expect, it } from "vitest"

import {
  developmentAuthPort,
  getAuthPort,
  unauthenticatedAuthPort,
} from "@/auth/ports"

describe("authentication ports", () => {
  it("provides an explicit permission-free viewer outside production", async () => {
    const port = getAuthPort("development")
    const viewer = await port.getCurrentViewer()

    expect(port).toBe(developmentAuthPort)
    expect(viewer).toEqual({
      id: "development-viewer",
      displayName: "Access Governance",
      permissions: [],
    })
  })

  it("returns no viewer from the production replacement boundary", async () => {
    const port = getAuthPort("production")

    expect(port).toBe(unauthenticatedAuthPort)
    await expect(port.getCurrentViewer()).resolves.toBeNull()
  })
})
