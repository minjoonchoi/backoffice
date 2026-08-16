import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ApplicationDetailPage } from "@/features/iam/application-pages"

export default async function Page({
  params,
}: {
  params: Promise<{ applicationId: string }>
}) {
  const { applicationId } = await params
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.applications.detail.key}>
      <ApplicationDetailPage applicationId={applicationId} />
    </UiResourceServerGate>
  )
}
