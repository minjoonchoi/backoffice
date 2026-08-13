import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { RolesPage } from "@/features/iam/role-pages"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.roles.list.key}>
      <RolesPage />
    </UiResourceServerGate>
  )
}
