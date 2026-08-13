import type { BackofficeState } from "@/application/state/model"
import type {
  AccessPolicy,
  AccessPolicyInput,
  AccessPolicyResource,
  AccessPolicyAssignmentTarget,
} from "@/features/access-policies/model"
import { resolveAuthorizationSubject } from "@/auth/authorization-subject"

type AccessPolicyAssignmentState = Pick<
  BackofficeState,
  "accessPolicies" | "accessPolicyAssignments" | "groups" | "roles" | "users"
>

export type EffectiveAccessPolicyPath = Readonly<
  | { type: "user"; targetId: string }
  | { type: "organization"; targetId: string }
  | { type: "role"; targetId: string; viaOrganizationId: string | null }
  | { type: "group"; targetId: string }
>

export type EffectiveAccessPolicyGrant = Readonly<{
  policy: AccessPolicy
  paths: readonly EffectiveAccessPolicyPath[]
}>

export type AccessPolicyUpdateImpact = Readonly<{
  affectedUserIds: readonly string[]
  assignmentCounts: Readonly<Record<AccessPolicyAssignmentTarget, number>>
  addedResources: readonly AccessPolicyResource[]
  removedResources: readonly AccessPolicyResource[]
  nameChanged: boolean
  descriptionChanged: boolean
  effectChanged: boolean
}>

export function resolveEffectiveAccessPolicyGrants(
  state: AccessPolicyAssignmentState,
  userId: string,
): readonly EffectiveAccessPolicyGrant[] {
  const subject = resolveAuthorizationSubject(state, userId)
  if (!subject) return []

  return state.accessPolicies
    .filter((policy) => policy.status === "active")
    .flatMap((policy): EffectiveAccessPolicyGrant[] => {
      const paths = state.accessPolicyAssignments
        .filter((assignment) => assignment.accessPolicyId === policy.id)
        .flatMap((assignment): EffectiveAccessPolicyPath[] => {
          if (assignment.targetType === "user") {
            return assignment.targetId === subject.user.id
              ? [{ type: "user", targetId: assignment.targetId }]
              : []
          }
          if (assignment.targetType === "organization") {
            return subject.organizationIds.has(assignment.targetId)
              ? [{ type: "organization", targetId: assignment.targetId }]
              : []
          }
          if (assignment.targetType === "group") {
            return subject.groupIds.has(assignment.targetId)
              ? [{ type: "group", targetId: assignment.targetId }]
              : []
          }
          const role = state.roles.find(
            (candidate) => candidate.id === assignment.targetId,
          )
          if (!role) return []
          const rolePaths: EffectiveAccessPolicyPath[] = []
          if (role.userIds.includes(subject.user.id)) {
            rolePaths.push({
              type: "role",
              targetId: role.id,
              viaOrganizationId: null,
            })
          }
          for (const organizationId of role.organizationIds) {
            if (subject.organizationIds.has(organizationId)) {
              rolePaths.push({
                type: "role",
                targetId: role.id,
                viaOrganizationId: organizationId,
              })
            }
          }
          return rolePaths
        })
      return paths.length ? [{ policy, paths }] : []
    })
}

export function resolveAccessPolicyAssignmentAffectedUserIds(
  state: AccessPolicyAssignmentState,
  assignmentId: string,
): readonly string[] {
  const assignment = state.accessPolicyAssignments.find(
    (candidate) => candidate.id === assignmentId,
  )
  if (!assignment) return []
  const nextState = {
    ...state,
    accessPolicyAssignments: state.accessPolicyAssignments.filter(
      (candidate) => candidate.id !== assignmentId,
    ),
  }
  return state.users.flatMap((user) => {
    const before = new Set(resolveAssignedAccessPolicyIds(state, user.id))
    const after = new Set(resolveAssignedAccessPolicyIds(nextState, user.id))
    return before.has(assignment.accessPolicyId) &&
      !after.has(assignment.accessPolicyId)
      ? [user.id]
      : []
  })
}

export function resolveAccessPolicyUpdateImpact(
  state: AccessPolicyAssignmentState,
  policy: AccessPolicy,
  input: AccessPolicyInput,
): AccessPolicyUpdateImpact {
  const assignments = state.accessPolicyAssignments.filter(
    (assignment) => assignment.accessPolicyId === policy.id,
  )
  const assignmentCounts: Record<AccessPolicyAssignmentTarget, number> = {
    user: 0,
    organization: 0,
    role: 0,
    group: 0,
  }
  for (const assignment of assignments) {
    assignmentCounts[assignment.targetType] += 1
  }

  return {
    affectedUserIds: state.users.flatMap((user) =>
      resolveAssignedAccessPolicyIds(state, user.id).includes(policy.id)
        ? [user.id]
        : [],
    ),
    assignmentCounts,
    addedResources: input.resources.filter(
      (resource) =>
        !policy.resources.some((candidate) =>
          matchesResource(candidate, resource),
        ),
    ),
    removedResources: policy.resources.filter(
      (resource) =>
        !input.resources.some((candidate) =>
          matchesResource(candidate, resource),
        ),
    ),
    nameChanged: policy.name !== input.name.trim(),
    descriptionChanged: policy.description !== input.description.trim(),
    effectChanged: policy.effect !== input.effect,
  }
}

export function resolveAssignedAccessPolicyIds(
  state: AccessPolicyAssignmentState,
  userId: string,
): readonly string[] {
  const subject = resolveAuthorizationSubject(state, userId)
  if (!subject) return []
  const activePolicyIds = new Set(
    state.accessPolicies
      .filter((policy) => policy.status === "active")
      .map((policy) => policy.id),
  )

  return [
    ...new Set(
      state.accessPolicyAssignments
        .filter(
          (assignment) =>
            activePolicyIds.has(assignment.accessPolicyId) &&
            (assignment.targetType === "user"
              ? assignment.targetId === subject.user.id
              : assignment.targetType === "organization"
                ? subject.organizationIds.has(assignment.targetId)
                : assignment.targetType === "role"
                  ? subject.roleIds.has(assignment.targetId)
                  : subject.groupIds.has(assignment.targetId)),
        )
        .map((assignment) => assignment.accessPolicyId),
    ),
  ]
}

function matchesResource(
  left: AccessPolicyResource,
  right: AccessPolicyResource,
) {
  return left.type === right.type && left.id === right.id
}

export function hasEffectiveAccessPolicyResource(
  state: AccessPolicyAssignmentState,
  userId: string,
  resource: AccessPolicyResource,
) {
  const assignedPolicyIds = new Set(
    resolveAssignedAccessPolicyIds(state, userId),
  )
  const matchingPolicies = state.accessPolicies.filter(
    (policy) =>
      policy.status === "active" &&
      assignedPolicyIds.has(policy.id) &&
      policy.resources.some((candidate) =>
        matchesResource(candidate, resource),
      ),
  )
  return (
    matchingPolicies.some((policy) => policy.effect === "allow") &&
    !matchingPolicies.some((policy) => policy.effect === "deny")
  )
}

export function resolveMissingAccessPolicyResources(
  state: AccessPolicyAssignmentState,
  userId: string,
  policy: AccessPolicy,
): readonly AccessPolicyResource[] {
  const assignedPolicyIds = new Set(
    resolveAssignedAccessPolicyIds(state, userId),
  )
  const assignedPolicies = state.accessPolicies.filter(
    (candidate) =>
      candidate.status === "active" && assignedPolicyIds.has(candidate.id),
  )

  return policy.resources.filter((resource) => {
    const matchingPolicies = assignedPolicies.filter((candidate) =>
      candidate.resources.some((candidateResource) =>
        matchesResource(candidateResource, resource),
      ),
    )
    if (policy.effect === "deny") {
      return !matchingPolicies.some((candidate) => candidate.effect === "deny")
    }
    return (
      !matchingPolicies.some((candidate) => candidate.effect === "allow") ||
      matchingPolicies.some((candidate) => candidate.effect === "deny")
    )
  })
}

export function hasEffectiveAccessPolicy(
  state: AccessPolicyAssignmentState,
  userId: string,
  policy: AccessPolicy,
) {
  return resolveMissingAccessPolicyResources(state, userId, policy).length === 0
}
