import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { RoleEditorPage } from "@/features/iam/role-editor-page"

export default async function Page({
  params,
}: {
  params: Promise<{ roleId: string }>
}) {
  const { roleId } = await params
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.roles.update.key}>
      <UiResourceServerGate
        resourceKey={uiResourceKeys.roles.detail.actions.updateRole}
      >
        <RoleEditorPage roleId={roleId} />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
