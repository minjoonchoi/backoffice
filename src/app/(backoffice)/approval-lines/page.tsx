import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ApprovalLinesPage } from "@/features/request-templates/request-template-pages"
export default function Page() {
  return (
    <UiResourceServerGate resourceKey={uiResourceKeys.approvalLines.list.key}>
      <ApprovalLinesPage />
    </UiResourceServerGate>
  )
}
