import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ApplicationEditorPage } from "@/features/iam/application-editor-page"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.applications.create.key}>
      <UiResourceServerGate
        resourceKey={uiResourceKeys.applications.list.actions.createApplication}
      >
        <ApplicationEditorPage />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
