import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { AccessPolicyEditorPage } from "@/features/access-policies/access-policy-editor-page"

export default async function Page({
  params,
}: {
  params: Promise<{ policyId: string }>
}) {
  const { policyId } = await params

  return (
    <UiResourceServerGate
      resourceKey={uiResourceKeys.approvalDocuments.update.key}
    >
      <UiResourceServerGate
        resourceKey={
          uiResourceKeys.approvalDocuments.detail.actions.updatePolicy
        }
      >
        <AccessPolicyEditorPage policyId={policyId} />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
