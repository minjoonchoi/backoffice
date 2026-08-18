import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { UsersPage } from "@/features/iam/directory-pages"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.users.list.key}>
      <UsersPage />
    </UiResourceServerGate>
  )
}
