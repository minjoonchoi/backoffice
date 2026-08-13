import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { UiResourcesPage } from "@/features/ui-resources/ui-resource-page"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.uiResources.list.key}>
      <UiResourcesPage />
    </UiResourceServerGate>
  )
}
