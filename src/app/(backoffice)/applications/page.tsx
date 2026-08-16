import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ApplicationsPage } from "@/features/iam/application-pages"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.applications.list.key}>
      <ApplicationsPage />
    </UiResourceServerGate>
  )
}
