import { notFound } from "next/navigation"

import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { entityIdSchema } from "@/domain/common"
import { CredentialIssuancePage } from "@/features/credentials/credential-issuance-page"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ serviceId?: string | string[] }>
}) {
  const rawServiceId = (await searchParams).serviceId
  const parsedServiceId =
    typeof rawServiceId === "string"
      ? entityIdSchema.safeParse(rawServiceId)
      : undefined
  if (rawServiceId !== undefined && !parsedServiceId?.success) notFound()
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.apiKeys.request.key}>
      <CredentialIssuancePage
        {...(parsedServiceId?.success
          ? { initialServiceId: parsedServiceId.data }
          : {})}
      />
    </UiResourceServerGate>
  )
}
