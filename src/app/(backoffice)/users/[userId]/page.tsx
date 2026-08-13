import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { UserDetailPage } from "@/features/iam/directory-pages"

export default async function Page({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.users.detail.key}>
      <UserDetailPage userId={userId} />
    </UiResourceServerGate>
  )
}
