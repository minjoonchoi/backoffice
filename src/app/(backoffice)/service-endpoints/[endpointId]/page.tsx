import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ServiceEndpointDetailPage } from "@/features/service-catalog/service-pages"

export default async function Page({
  params,
}: {
  params: Promise<{ endpointId: string }>
}) {
  const { endpointId } = await params
  return (
    <UiResourceServerGate
      resourceKey={uiResourceKeys.serviceEndpoints.detail.key}
    >
      <ServiceEndpointDetailPage endpointId={endpointId} />
    </UiResourceServerGate>
  )
}
