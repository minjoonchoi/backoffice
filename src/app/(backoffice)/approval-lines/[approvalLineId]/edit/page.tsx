import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { RequestTemplateEditorPage } from "@/features/request-templates/request-template-editor-page"

export default async function Page({
  params,
}: {
  params: Promise<{ approvalLineId: string }>
}) {
  const { approvalLineId } = await params

  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.approvalLines.update.key}>
      <UiResourceServerGate
        resourceKey={
          uiResourceKeys.approvalLines.detail.actions.updateRequestTemplate
        }
      >
        <RequestTemplateEditorPage templateId={approvalLineId} />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
