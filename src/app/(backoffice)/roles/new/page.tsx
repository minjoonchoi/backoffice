import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { RoleEditorPage } from "@/features/iam/role-editor-page"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.roles.create.key}>
      <UiResourceServerGate
        resourceKey={uiResourceKeys.roles.list.actions.createRole}
      >
        <RoleEditorPage />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
