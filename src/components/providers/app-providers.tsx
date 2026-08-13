"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl"
import { useState, type ReactNode } from "react"

import { SnackbarProvider } from "@/components/ui/snackbar"
import { defaultTimeZone, type Locale } from "@/i18n/config"

export type AppProvidersProps = {
  children: ReactNode
  locale: Locale
  messages: AbstractIntlMessages
}

export function AppProviders({
  children,
  locale,
  messages,
}: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      }),
  )

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={defaultTimeZone}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      <SnackbarProvider />
    </NextIntlClientProvider>
  )
}
