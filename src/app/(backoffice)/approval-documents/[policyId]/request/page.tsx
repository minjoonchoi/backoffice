import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ApprovalDocumentRequestPage } from "@/features/access-policies/approval-document-request-page"

export default async function Page({
  params,
}: {
  params: Promise<{ policyId: string }>
}) {
  const { policyId } = await params

  return (
    <UiResourceServerGate
      resourceKey={uiResourceKeys.approvalDocuments.request.key}
    >
      <ApprovalDocumentRequestPage policyId={policyId} />
    </UiResourceServerGate>
  )
}
