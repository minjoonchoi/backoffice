import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { OrganizationEditorPage } from "@/features/iam/directory-editor-pages"

export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string }>
}) {
  const { organizationId } = await params
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.organizations.update.key}>
      <UiResourceServerGate
        resourceKey={
          uiResourceKeys.organizations.detail.actions.updateOrganization
        }
      >
        <OrganizationEditorPage organizationId={organizationId} />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
