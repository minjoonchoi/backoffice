import { describe, expect, it } from "vitest"

import { isBackofficeAccessAllowed } from "./src/proxy"

describe("backoffice production access guard", () => {
  it("allows local development", () => {
    expect(isBackofficeAccessAllowed("development")).toBe(true)
  })

  it("blocks production when the temporary override is absent or invalid", () => {
    expect(isBackofficeAccessAllowed("production")).toBe(false)
    expect(isBackofficeAccessAllowed("production", "TRUE")).toBe(false)
  })

  it("allows only the explicit production override", () => {
    expect(isBackofficeAccessAllowed("production", "true")).toBe(true)
  })
})
