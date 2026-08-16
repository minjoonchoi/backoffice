import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { CredentialLifecycleRequestPage } from "@/features/credentials/credential-lifecycle-request-page"

export default async function Page({
  params,
}: {
  params: Promise<{ apiKeyId: string }>
}) {
  const { apiKeyId } = await params

  return (
    <UiResourceServerGate
      resourceKey={uiResourceKeys.apiKeys.disposeRequest.key}
    >
      <CredentialLifecycleRequestPage
        apiKeyId={apiKeyId}
        type="api-key-dispose"
      />
    </UiResourceServerGate>
  )
}
