import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { RequestTemplateEditorPage } from "@/features/request-templates/request-template-editor-page"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.approvalLines.create.key}>
      <UiResourceServerGate
        resourceKey={
          uiResourceKeys.approvalLines.list.actions.createRequestTemplate
        }
      >
        <RequestTemplateEditorPage />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
