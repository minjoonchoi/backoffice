import type { Locale } from "@/i18n/config"

import en from "../../messages/en.json"
import ko from "../../messages/ko.json"

export const messagesByLocale = { en, ko } as const satisfies Record<
  Locale,
  typeof ko
>

export function getMessagesForLocale(locale: Locale) {
  return messagesByLocale[locale]
}
