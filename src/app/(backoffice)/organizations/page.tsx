import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { OrganizationsPage } from "@/features/iam/directory-pages"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.organizations.list.key}>
      <OrganizationsPage />
    </UiResourceServerGate>
  )
}
