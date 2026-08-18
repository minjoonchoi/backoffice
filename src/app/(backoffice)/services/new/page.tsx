import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ServiceEditorPage } from "@/features/service-catalog/service-editor-pages"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.services.create.key}>
      <UiResourceServerGate
        resourceKey={uiResourceKeys.services.list.actions.createService}
      >
        <ServiceEditorPage />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
