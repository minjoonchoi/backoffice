import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { AccessPolicyDetailPage } from "@/features/access-policies/access-policy-detail-page"

export default async function Page({
  params,
}: {
  params: Promise<{ policyId: string }>
}) {
  const { policyId } = await params
  return (
    <UiResourceServerGate
      resourceKey={uiResourceKeys.approvalDocuments.detail.key}
    >
      <AccessPolicyDetailPage policyId={policyId} />
    </UiResourceServerGate>
  )
}
