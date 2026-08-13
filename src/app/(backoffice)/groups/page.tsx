import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { GroupsPage } from "@/features/iam/group-pages"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.groups.list.key}>
      <GroupsPage />
    </UiResourceServerGate>
  )
}
