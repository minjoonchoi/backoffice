import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { UiResourceDetailPage } from "@/features/ui-resources/ui-resource-detail-page"

export default async function Page({
  params,
}: {
  params: Promise<{ uiResourceId: string }>
}) {
  const { uiResourceId } = await params
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.uiResources.detail.key}>
      <UiResourceDetailPage uiResourceId={uiResourceId} />
    </UiResourceServerGate>
  )
}
