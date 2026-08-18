import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { UserEditorPage } from "@/features/iam/directory-editor-pages"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.users.create.key}>
      <UiResourceServerGate
        resourceKey={uiResourceKeys.users.list.actions.createUser}
      >
        <UserEditorPage />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
