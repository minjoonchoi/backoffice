import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { AccessPolicyEditorPage } from "@/features/access-policies/access-policy-editor-page"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ sourcePolicyId?: string | string[] }>
}) {
  const requestedSourcePolicyId = (await searchParams).sourcePolicyId
  const sourcePolicyId =
    typeof requestedSourcePolicyId === "string"
      ? requestedSourcePolicyId
      : undefined

  return (
    <UiResourceServerGate
      resourceKey={uiResourceKeys.approvalDocuments.create.key}
    >
      <UiResourceServerGate
        resourceKey={uiResourceKeys.approvalDocuments.list.actions.createPolicy}
      >
        <AccessPolicyEditorPage
          {...(sourcePolicyId ? { sourcePolicyId } : {})}
        />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
