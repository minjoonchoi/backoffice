import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ServiceEditorPage } from "@/features/service-catalog/service-editor-pages"

export default async function Page({
  params,
}: {
  params: Promise<{ serviceId: string }>
}) {
  const { serviceId } = await params
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.services.update.key}>
      <UiResourceServerGate
        resourceKey={uiResourceKeys.services.detail.actions.updateService}
      >
        <ServiceEditorPage serviceId={serviceId} />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
