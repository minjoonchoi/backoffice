import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ServiceEndpointEditorPage } from "@/features/service-catalog/service-editor-pages"

export default function Page() {
  return (
    <UiResourceServerGate
      resourceKey={uiResourceKeys.serviceEndpoints.create.key}
    >
      <UiResourceServerGate
        resourceKey={
          uiResourceKeys.serviceEndpoints.list.actions.createEndpoint
        }
      >
        <ServiceEndpointEditorPage />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
