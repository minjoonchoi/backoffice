import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  canAccess: vi.fn<(resourceKey: string) => Promise<boolean>>(),
  forbidden: vi.fn<() => never>(),
}))

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({ forbidden: mocks.forbidden }))
vi.mock("@/auth/server-ui-resource-access", () => ({
  canServerAccessUiResource: mocks.canAccess,
}))

import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"

describe("UiResourceServerGate", () => {
  it("renders an authorized view", async () => {
    mocks.canAccess.mockResolvedValueOnce(true)

    await expect(
      UiResourceServerGate({
        resourceKey: "users:list",
        children: "사용자 목록",
      }),
    ).resolves.toBe("사용자 목록")
    expect(mocks.canAccess).toHaveBeenCalledWith("users:list")
  })

  it("interrupts unauthorized view rendering with a 403", async () => {
    const forbiddenError = new Error("NEXT_HTTP_ERROR_FALLBACK;403")
    mocks.canAccess.mockResolvedValueOnce(false)
    mocks.forbidden.mockImplementationOnce(() => {
      throw forbiddenError
    })

    await expect(
      UiResourceServerGate({
        resourceKey: "users:detail",
        children: "사용자 상세",
      }),
    ).rejects.toBe(forbiddenError)
    expect(mocks.forbidden).toHaveBeenCalledOnce()
  })
})
