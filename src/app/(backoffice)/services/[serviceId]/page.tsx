import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ServiceDetailPage } from "@/features/service-catalog/service-pages"
export default async function Page({
  params,
}: {
  params: Promise<{ serviceId: string }>
}) {
  const { serviceId } = await params
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.services.detail.key}>
      <ServiceDetailPage serviceId={serviceId} />
    </UiResourceServerGate>
  )
}
