import { UiResourceServerGate } from "@/auth/ui-resource-server-gate"
import { uiResourceKeys } from "@/config/menu-registry"
import { ApprovalReviewPage } from "@/features/access-policies/approval-review-page"

export default function Page() {
  return (
    <UiResourceServerGate
      resourceKey={uiResourceKeys.approvalDocuments.list.key}
    >
      <ApprovalReviewPage />
    </UiResourceServerGate>
  )
}
