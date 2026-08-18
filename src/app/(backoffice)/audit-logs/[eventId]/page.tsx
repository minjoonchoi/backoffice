import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { AuditLogDetailPage } from "@/features/audit/audit-log-page"

export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.auditLogs.detail.key}>
      <AuditLogDetailPage eventId={eventId} />
    </UiResourceServerGate>
  )
}
