import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { Button } from "@/components/ui/button"

export default async function NotFound() {
  const t = await getTranslations("notFound")

  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <Button nativeButton={false} render={<Link href="/" />}>
          {t("backHome")}
        </Button>
      </div>
    </main>
  )
}
