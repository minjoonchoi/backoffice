import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { RequestTemplateEditorPage } from "@/features/request-templates/request-template-editor-page"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ sourceId?: string }>
}) {
  const { sourceId } = await searchParams
  const editor = <RequestTemplateEditorPage sourceTemplateId={sourceId} />

  if (sourceId) {
    return (
      <UiResourceServerGate
        resourceKey={uiResourceKeys.approvalLines.create.key}
      >
        <UiResourceServerGate
          resourceKey={
            uiResourceKeys.approvalLines.detail.actions.cloneRequestTemplate
          }
        >
          {editor}
        </UiResourceServerGate>
      </UiResourceServerGate>
    )
  }

  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.approvalLines.create.key}>
      <UiResourceServerGate
        resourceKey={
          uiResourceKeys.approvalLines.list.actions.createRequestTemplate
        }
      >
        {editor}
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
