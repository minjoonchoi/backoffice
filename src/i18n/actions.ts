"use server"

import { cookies } from "next/headers"
import { z } from "zod"

import { localeCookieName, locales } from "@/i18n/config"
import { localeCookieOptions } from "@/i18n/cookie"

const localeSchema = z.enum(locales)

export async function setLocale(value: unknown) {
  const locale = localeSchema.parse(value)
  const cookieStore = await cookies()
  cookieStore.set(localeCookieName, locale, localeCookieOptions)
}
