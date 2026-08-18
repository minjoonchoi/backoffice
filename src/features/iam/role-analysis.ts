import { accessPolicyAssignmentTargets } from "@/features/access-policies/model"
import type { BackofficeState } from "@/application/state/model"
import { isAccessPolicyEffective } from "@/features/access-policies/access-policy-status"
import type { Role } from "@/features/iam/model"

type RoleAnalysisState = Pick<
  BackofficeState,
  "accessPolicies" | "accessPolicyAssignments"
>

export type RoleComparison = Readonly<{
  onlyLeftPolicyIds: readonly string[]
  sharedPolicyIds: readonly string[]
  onlyRightPolicyIds: readonly string[]
  onlyLeftResourceKeys: readonly string[]
  sharedResourceKeys: readonly string[]
  onlyRightResourceKeys: readonly string[]
}>

export function isUnusedRole(role: Role) {
  return role.userIds.length === 0 && role.organizationIds.length === 0
}

function rolePolicyIds(state: RoleAnalysisState, roleId: string) {
  const effectivePolicyIds = new Set(
    state.accessPolicies
      .filter((policy) => isAccessPolicyEffective(policy))
      .map((policy) => policy.id),
  )
  return new Set(
    state.accessPolicyAssignments
      .filter(
        (assignment) =>
          assignment.targetType === accessPolicyAssignmentTargets.role &&
          assignment.targetId === roleId &&
          effectivePolicyIds.has(assignment.accessPolicyId),
      )
      .map((assignment) => assignment.accessPolicyId),
  )
}

function resourceKeysForPolicies(
  state: RoleAnalysisState,
  policyIds: ReadonlySet<string>,
) {
  return new Set(
    state.accessPolicies
      .filter((policy) => policyIds.has(policy.id))
      .flatMap((policy) =>
        policy.resources.map((resource) => `${resource.type}:${resource.id}`),
      ),
  )
}

function compareSets(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  return {
    onlyLeft: [...left].filter((value) => !right.has(value)).sort(),
    shared: [...left].filter((value) => right.has(value)).sort(),
    onlyRight: [...right].filter((value) => !left.has(value)).sort(),
  }
}

export function compareRoles(
  state: RoleAnalysisState,
  leftRoleId: string,
  rightRoleId: string,
): RoleComparison {
  const leftPolicyIds = rolePolicyIds(state, leftRoleId)
  const rightPolicyIds = rolePolicyIds(state, rightRoleId)
  const policyComparison = compareSets(leftPolicyIds, rightPolicyIds)
  const resourceComparison = compareSets(
    resourceKeysForPolicies(state, leftPolicyIds),
    resourceKeysForPolicies(state, rightPolicyIds),
  )
  return {
    onlyLeftPolicyIds: policyComparison.onlyLeft,
    sharedPolicyIds: policyComparison.shared,
    onlyRightPolicyIds: policyComparison.onlyRight,
    onlyLeftResourceKeys: resourceComparison.onlyLeft,
    sharedResourceKeys: resourceComparison.shared,
    onlyRightResourceKeys: resourceComparison.onlyRight,
  }
}
