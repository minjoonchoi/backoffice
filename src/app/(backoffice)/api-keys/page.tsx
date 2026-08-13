import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ApiKeyPage } from "@/features/credentials/api-key-page"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.apiKeys.list.key}>
      <ApiKeyPage />
    </UiResourceServerGate>
  )
}
