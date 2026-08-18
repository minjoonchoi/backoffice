import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { HomeDashboard } from "@/features/home/home-dashboard"

export default function HomePage() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.home.overview.key}>
      <HomeDashboard />
    </UiResourceServerGate>
  )
}
