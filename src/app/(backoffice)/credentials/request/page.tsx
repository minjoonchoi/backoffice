import { notFound } from "next/navigation"

import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { entityIdSchema } from "@/domain/common"
import { CredentialIssuancePage } from "@/features/credentials/credential-issuance-page"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    applicationId?: string | string[]
    serviceId?: string | string[]
  }>
}) {
  const { applicationId: rawApplicationId, serviceId: rawServiceId } =
    await searchParams
  const parsedApplicationId =
    typeof rawApplicationId === "string"
      ? entityIdSchema.safeParse(rawApplicationId)
      : undefined
  const parsedServiceId =
    typeof rawServiceId === "string"
      ? entityIdSchema.safeParse(rawServiceId)
      : undefined
  if (rawApplicationId !== undefined && !parsedApplicationId?.success) {
    notFound()
  }
  if (rawServiceId !== undefined && !parsedServiceId?.success) notFound()
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.apiKeys.request.key}>
      <CredentialIssuancePage
        {...(parsedApplicationId?.success
          ? { initialApplicationId: parsedApplicationId.data }
          : {})}
        {...(parsedServiceId?.success
          ? { initialServiceId: parsedServiceId.data }
          : {})}
      />
    </UiResourceServerGate>
  )
}
