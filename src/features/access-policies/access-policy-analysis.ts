import { accessPolicyEffects } from "@/features/access-policies/model"
import type { BackofficeState } from "@/application/state/model"
import type {
  AccessPolicy,
  AccessPolicyResource,
} from "@/features/access-policies/model"
import { resolveAssignedAccessPolicyIds } from "@/features/access-policies/access-policy-assignment"
import { isAccessPolicyEffective } from "@/features/access-policies/access-policy-status"

type PolicyAnalysisState = Pick<
  BackofficeState,
  "accessPolicies" | "accessPolicyAssignments" | "roles" | "users"
>

export type AccessPolicyConflict = Readonly<{
  resource: AccessPolicyResource
  allowPolicyIds: readonly string[]
  denyPolicyIds: readonly string[]
}>

export type AccessPolicySimulation = Readonly<{
  granted: readonly AccessPolicyResource[]
  alreadyGranted: readonly AccessPolicyResource[]
  denied: readonly AccessPolicyResource[]
}>

function resourceKey(resource: AccessPolicyResource) {
  return `${resource.type}:${resource.id}`
}

export function resolveAccessPolicyConflicts(
  policies: readonly AccessPolicy[],
): readonly AccessPolicyConflict[] {
  const policiesByResource = new Map<
    string,
    {
      resource: AccessPolicyResource
      allowPolicyIds: string[]
      denyPolicyIds: string[]
    }
  >()
  for (const policy of policies) {
    if (!isAccessPolicyEffective(policy)) continue
    for (const resource of policy.resources) {
      const key = resourceKey(resource)
      const entry = policiesByResource.get(key) ?? {
        resource,
        allowPolicyIds: [],
        denyPolicyIds: [],
      }
      if (policy.effect === accessPolicyEffects.allow)
        entry.allowPolicyIds.push(policy.id)
      else entry.denyPolicyIds.push(policy.id)
      policiesByResource.set(key, entry)
    }
  }
  return [...policiesByResource.values()].filter(
    (entry) =>
      entry.allowPolicyIds.length > 0 && entry.denyPolicyIds.length > 0,
  )
}

export function simulateAccessPolicyGrant(
  state: PolicyAnalysisState,
  userId: string,
  policy: AccessPolicy,
  now = new Date(),
): AccessPolicySimulation {
  const assignedIds = new Set(
    resolveAssignedAccessPolicyIds(state, userId, now),
  )
  const currentPolicies = state.accessPolicies.filter(
    (candidate) =>
      assignedIds.has(candidate.id) && isAccessPolicyEffective(candidate),
  )
  const granted: AccessPolicyResource[] = []
  const alreadyGranted: AccessPolicyResource[] = []
  const denied: AccessPolicyResource[] = []

  for (const resource of policy.resources) {
    const key = resourceKey(resource)
    const matching = currentPolicies.filter((candidate) =>
      candidate.resources.some((item) => resourceKey(item) === key),
    )
    if (
      policy.effect === accessPolicyEffects.deny ||
      matching.some((item) => item.effect === accessPolicyEffects.deny)
    ) {
      denied.push(resource)
    } else if (
      matching.some((item) => item.effect === accessPolicyEffects.allow)
    ) {
      alreadyGranted.push(resource)
    } else {
      granted.push(resource)
    }
  }
  return { granted, alreadyGranted, denied }
}
