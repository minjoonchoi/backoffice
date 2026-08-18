import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ServiceEndpointSyncPage } from "@/features/service-catalog/service-endpoint-sync-page"

export default function Page() {
  return (
    <UiResourceServerGate
      resourceKey={uiResourceKeys.serviceEndpoints.sync.key}
    >
      <ServiceEndpointSyncPage />
    </UiResourceServerGate>
  )
}
