import { cookies } from "next/headers"

import { localeCookieName, resolveLocale } from "@/i18n/config"

export async function getRequestLocale() {
  const cookieStore = await cookies()
  return resolveLocale(cookieStore.get(localeCookieName)?.value)
}
