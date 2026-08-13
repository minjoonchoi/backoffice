import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ApprovalLineDetailPage } from "@/features/request-templates/request-template-pages"

export default async function Page({
  params,
}: {
  params: Promise<{ approvalLineId: string }>
}) {
  const { approvalLineId } = await params
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.approvalLines.detail.key}>
      <ApprovalLineDetailPage approvalLineId={approvalLineId} />
    </UiResourceServerGate>
  )
}
