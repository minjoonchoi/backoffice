import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { RoleDetailPage } from "@/features/iam/role-pages"

export default async function Page({
  params,
}: {
  params: Promise<{ roleId: string }>
}) {
  const { roleId } = await params
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.roles.detail.key}>
      <RoleDetailPage roleId={roleId} />
    </UiResourceServerGate>
  )
}
