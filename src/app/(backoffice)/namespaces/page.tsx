import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { NamespacesPage } from "@/features/ui-resources/namespace-page"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.namespaces.list.key}>
      <NamespacesPage />
    </UiResourceServerGate>
  )
}
