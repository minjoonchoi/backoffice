import { getRequestConfig } from "next-intl/server"

import { defaultTimeZone } from "@/i18n/config"
import { getMessagesForLocale } from "@/i18n/messages"
import { getRequestLocale } from "@/i18n/server"

export default getRequestConfig(async () => {
  const locale = await getRequestLocale()

  return {
    locale,
    messages: getMessagesForLocale(locale),
    timeZone: defaultTimeZone,
  }
})
