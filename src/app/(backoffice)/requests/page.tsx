import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { AllRequestsPage } from "@/features/access-policies/all-requests-page"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.requests.list.key}>
      <AllRequestsPage />
    </UiResourceServerGate>
  )
}
