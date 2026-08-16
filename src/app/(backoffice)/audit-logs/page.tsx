import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { AuditLogPage } from "@/features/audit/audit-log-page"

export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.auditLogs.list.key}>
      <AuditLogPage />
    </UiResourceServerGate>
  )
}
