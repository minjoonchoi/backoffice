import { beforeEach, describe, expect, it, vi } from "vitest"

const { setCookie } = vi.hoisted(() => ({ setCookie: vi.fn() }))

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ set: setCookie })),
}))

import { setLocale } from "@/i18n/actions"
import { localeCookieName } from "@/i18n/config"
import { localeCookieOptions } from "@/i18n/cookie"

describe("setLocale", () => {
  beforeEach(() => setCookie.mockReset())

  it("stores a validated locale in the locale cookie", async () => {
    await setLocale("en")

    expect(setCookie).toHaveBeenCalledWith(
      localeCookieName,
      "en",
      localeCookieOptions,
    )
  })

  it("rejects unsupported locale input without changing the cookie", async () => {
    await expect(setLocale("ja")).rejects.toThrow()
    expect(setCookie).not.toHaveBeenCalled()
  })
})
