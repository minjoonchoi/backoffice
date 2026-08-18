import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { NamespaceDetailPage } from "@/features/ui-resources/namespace-detail-page"

export default async function Page({
  params,
}: {
  params: Promise<{ namespaceId: string }>
}) {
  const { namespaceId } = await params
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.namespaces.detail.key}>
      <NamespaceDetailPage namespaceId={namespaceId} />
    </UiResourceServerGate>
  )
}
