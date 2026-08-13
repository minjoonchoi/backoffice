import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ApiKeyDetailPage } from "@/features/credentials/api-key-page"

export default async function Page({
  params,
}: {
  params: Promise<{ apiKeyId: string }>
}) {
  const { apiKeyId } = await params
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.apiKeys.detail.key}>
      <ApiKeyDetailPage apiKeyId={apiKeyId} />
    </UiResourceServerGate>
  )
}
