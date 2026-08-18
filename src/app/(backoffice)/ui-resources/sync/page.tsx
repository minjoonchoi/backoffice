import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { UiResourceSyncPage } from "@/features/ui-resources/ui-resource-page"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.uiResources.sync.key}>
      <UiResourceServerGate
        resourceKey={uiResourceKeys.uiResources.list.actions.importUiResources}
      >
        <UiResourceSyncPage />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
