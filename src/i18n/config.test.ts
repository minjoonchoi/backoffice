import { describe, expect, it } from "vitest"

import { defaultLocale, isLocale, resolveLocale } from "@/i18n/config"
import { getMessagesForLocale } from "@/i18n/messages"

describe("locale configuration", () => {
  it.each(["ko", "en"])("accepts the supported locale %s", (locale) => {
    expect(isLocale(locale)).toBe(true)
    expect(resolveLocale(locale)).toBe(locale)
  })

  it.each([undefined, null, "", "ja", 1])(
    "falls back to Korean for %s",
    (locale) => {
      expect(isLocale(locale)).toBe(false)
      expect(resolveLocale(locale)).toBe(defaultLocale)
    },
  )

  it("loads a complete message catalog for each supported locale", () => {
    expect(getMessagesForLocale("ko").shell.home).toBe("홈")
    expect(getMessagesForLocale("en").shell.home).toBe("Home")
  })
})
