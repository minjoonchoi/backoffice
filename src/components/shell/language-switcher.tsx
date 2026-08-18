"use client"

import { Languages } from "lucide-react"
import { useLocale } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition, type ChangeEvent } from "react"

import { setLocale } from "@/i18n/actions"
import { type Locale, locales } from "@/i18n/config"

export type LanguageSwitcherProps = {
  label: string
  localeLabels: Record<Locale, string>
}

export function LanguageSwitcher({
  label,
  localeLabels,
}: LanguageSwitcherProps) {
  const locale = useLocale() as Locale
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value
    startTransition(async () => {
      await setLocale(nextLocale)
      router.refresh()
    })
  }

  return (
    <label className="relative flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2 text-xs font-medium focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      <Languages className="size-3.5 text-muted-foreground" aria-hidden />
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className="max-w-24 appearance-none bg-transparent pr-4 outline-none disabled:cursor-wait"
        value={locale}
        disabled={pending}
        onChange={handleChange}
      >
        {locales.map((option) => (
          <option key={option} value={option}>
            {localeLabels[option]}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute right-2 text-muted-foreground"
        aria-hidden
      >
        ▾
      </span>
    </label>
  )
}
