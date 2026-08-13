import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { GroupDetailPage } from "@/features/iam/group-pages"

export default async function Page({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.groups.detail.key}>
      <GroupDetailPage groupId={groupId} />
    </UiResourceServerGate>
  )
}
