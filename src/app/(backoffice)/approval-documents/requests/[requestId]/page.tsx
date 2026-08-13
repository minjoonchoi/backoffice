import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ApprovalDocumentDetailPage } from "@/features/access-policies/approval-document-detail-page"

export default async function Page({
  params,
}: {
  params: Promise<{ requestId: string }>
}) {
  const { requestId } = await params
  return (
    <UiResourceServerGate
      resourceKey={uiResourceKeys.approvalDocuments.requestDetail.key}
    >
      <ApprovalDocumentDetailPage requestId={requestId} />
    </UiResourceServerGate>
  )
}
