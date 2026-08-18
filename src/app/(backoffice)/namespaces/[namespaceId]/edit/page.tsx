import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { NamespaceEditorPage } from "@/features/ui-resources/namespace-editor-page"

export default async function Page({
  params,
}: {
  params: Promise<{ namespaceId: string }>
}) {
  const { namespaceId } = await params
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.namespaces.update.key}>
      <UiResourceServerGate
        resourceKey={
          uiResourceKeys.namespaces.detail.actions.changeNamespaceManager
        }
      >
        <NamespaceEditorPage namespaceId={namespaceId} />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
