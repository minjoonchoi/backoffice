import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { OrganizationEditorPage } from "@/features/iam/directory-editor-pages"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.organizations.create.key}>
      <UiResourceServerGate
        resourceKey={
          uiResourceKeys.organizations.list.actions.createOrganization
        }
      >
        <OrganizationEditorPage />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
