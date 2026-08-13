import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"

import { AppProviders } from "@/components/providers/app-providers"
import { getMessagesForLocale } from "@/i18n/messages"
import { getRequestLocale } from "@/i18n/server"

import "./globals.css"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  const t = await getTranslations({ locale, namespace: "metadata" })

  return {
    title: t("title"),
    description: t("description"),
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const locale = await getRequestLocale()
  const messages = getMessagesForLocale(locale)

  return (
    <html lang={locale}>
      <body>
        <AppProviders locale={locale} messages={messages}>
          {children}
        </AppProviders>
      </body>
    </html>
  )
}
