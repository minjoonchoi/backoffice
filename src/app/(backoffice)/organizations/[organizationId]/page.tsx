import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { OrganizationDetailPage } from "@/features/iam/directory-pages"

export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string }>
}) {
  const { organizationId } = await params
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.organizations.detail.key}>
      <OrganizationDetailPage organizationId={organizationId} />
    </UiResourceServerGate>
  )
}
