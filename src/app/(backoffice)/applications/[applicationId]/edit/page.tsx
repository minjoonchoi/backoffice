import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ApplicationEditorPage } from "@/features/iam/application-editor-page"

export default async function Page({
  params,
}: {
  params: Promise<{ applicationId: string }>
}) {
  const { applicationId } = await params
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.applications.update.key}>
      <UiResourceServerGate
        resourceKey={
          uiResourceKeys.applications.detail.actions.updateApplication
        }
      >
        <ApplicationEditorPage applicationId={applicationId} />
      </UiResourceServerGate>
    </UiResourceServerGate>
  )
}
