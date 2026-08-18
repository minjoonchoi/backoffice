import type { AccessPolicy } from "@/features/access-policies/model"
import { entityStatuses } from "@/domain/common"

export function isAccessPolicyEffective(policy: Pick<AccessPolicy, "status">) {
  return policy.status === entityStatuses.active
}
