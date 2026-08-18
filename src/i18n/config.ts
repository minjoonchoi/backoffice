export const locales = ["ko", "en"] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "ko"
export const defaultTimeZone = "Asia/Seoul"
export const localeCookieName = "NEXT_LOCALE"

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.some((locale) => locale === value)
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale
}
