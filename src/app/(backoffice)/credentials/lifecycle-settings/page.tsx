import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { CredentialLifecycleSettingsPage } from "@/features/credentials/credential-lifecycle-settings-page"

export default function Page() {
  return (
    <UiResourceServerGate
      resourceKey={uiResourceKeys.apiKeys.lifecycleSettings.key}
    >
      <CredentialLifecycleSettingsPage />
    </UiResourceServerGate>
  )
}
