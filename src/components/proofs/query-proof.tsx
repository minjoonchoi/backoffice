"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { z } from "zod"

import { ErrorState, LoadingState } from "@/components/patterns/content-state"
import { FetchApiTransport } from "@/lib/api-transport"

const statusSchema = z.object({ status: z.literal("ready") })
const transport = new FetchApiTransport()

export function QueryProof() {
  const t = useTranslations("proof")
  const query = useQuery({
    queryKey: ["foundation-proof"],
    queryFn: () =>
      transport.request({ path: "/api/foundation/status" }, statusSchema),
  })

  if (query.isPending) {
    return (
      <LoadingState title={t("queryTitle")} description={t("queryTitle")} />
    )
  }

  if (query.isError) {
    return (
      <ErrorState
        title={t("queryTitle")}
        description={query.error.message}
        retryLabel="Retry"
        onRetry={() => void query.refetch()}
      />
    )
  }

  return (
    <section role="status" className="rounded-xl border bg-card p-6">
      <h2 className="font-medium">{t("queryTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("queryReady")}</p>
    </section>
  )
}
