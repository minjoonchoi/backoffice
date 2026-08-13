import { ShieldX } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { Button } from "@/components/ui/button"

export default async function Forbidden() {
  const t = await getTranslations("forbidden")

  return (
    <section
      className="grid min-h-[32rem] place-items-center p-6"
      aria-labelledby="forbidden-title"
    >
      <div className="grid max-w-md justify-items-center gap-4 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-destructive text-destructive-foreground">
          <ShieldX className="size-6" aria-hidden />
        </span>
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-destructive">403</p>
          <h1
            id="forbidden-title"
            className="text-2xl font-semibold tracking-tight"
          >
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button nativeButton={false} render={<Link href="/" />}>
          {t("backHome")}
        </Button>
      </div>
    </section>
  )
}
