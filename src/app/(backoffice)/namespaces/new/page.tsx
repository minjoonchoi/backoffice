import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { NamespaceEditorPage } from "@/features/ui-resources/namespace-editor-page"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.namespaces.create.key}>
      <UiResourceServerGate
        resourceKey={uiResourceKeys.namespaces.list.actions.createNamespace}
      >
        <NamespaceEditorPage />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
