import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { UiNamespacesPage } from "@/features/ui-resources/ui-namespace-page"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.namespaces.list.key}>
      <UiNamespacesPage />
    </UiResourceServerGate>
  )
}
