import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ServiceEndpointsPage } from "@/features/service-catalog/service-pages"
export default function Page() {
  return (
    <UiResourceServerGate
      resourceKey={uiResourceKeys.serviceEndpoints.list.key}
    >
      <ServiceEndpointsPage />
    </UiResourceServerGate>
  )
}
