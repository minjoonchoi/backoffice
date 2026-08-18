import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ServiceEndpointEditorPage } from "@/features/service-catalog/service-editor-pages"

export default async function Page({
  params,
}: {
  params: Promise<{ endpointId: string }>
}) {
  const { endpointId } = await params
  return (
    <UiResourceServerGate
      resourceKey={uiResourceKeys.serviceEndpoints.update.key}
    >
      <UiResourceServerGate
        resourceKey={
          uiResourceKeys.serviceEndpoints.detail.actions.updateEndpoint
        }
      >
        <ServiceEndpointEditorPage endpointId={endpointId} />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
