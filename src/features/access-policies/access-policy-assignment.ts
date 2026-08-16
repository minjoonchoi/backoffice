import { accessPolicyAssignmentTargets } from "@/features/access-policies/model"
import { accessPolicyEffects } from "@/features/access-policies/model"
import type { BackofficeState } from "@/application/state/model"
import type {
  AccessPolicy,
  AccessPolicyResource,
  AccessPolicyAssignmentTarget,
  AccessPolicyValue,
} from "@/features/access-policies/model"
import { resolveAuthorizationSubject } from "@/auth/authorization-subject"
import { isAccessPolicyEffective } from "@/features/access-policies/access-policy-status"

type AccessPolicyAssignmentState = Pick<
  BackofficeState,
  "accessPolicies" | "accessPolicyAssignments" | "roles" | "users"
>

export type EffectiveAccessPolicyPath = Readonly<
  | { type: "user"; targetId: string; expiresAt: string | null }
  | { type: "organization"; targetId: string; expiresAt: string | null }
  | {
      type: "role"
      targetId: string
      viaOrganizationId: string | null
      expiresAt: string | null
    }
>

export type EffectiveAccessPolicyGrant = Readonly<{
  policy: AccessPolicy
  paths: readonly EffectiveAccessPolicyPath[]
}>

export type AccessPolicyUpdateImpact = Readonly<{
  permissionChanges: readonly Readonly<{
    userId: string
    gainedResources: readonly AccessPolicyResource[]
    lostResources: readonly AccessPolicyResource[]
  }>[]
  notificationRecipientUserIds: readonly string[]
  assignmentCounts: Readonly<Record<AccessPolicyAssignmentTarget, number>>
  addedResources: readonly AccessPolicyResource[]
  removedResources: readonly AccessPolicyResource[]
  nameChanged: boolean
  descriptionChanged: boolean
  effectChanged: boolean
}>

export function isAccessPolicyAssignmentEffective(
  assignment: Pick<
    AccessPolicyAssignmentState["accessPolicyAssignments"][number],
    "expiresAt"
  >,
  now = new Date(),
) {
  return (
    assignment.expiresAt === null ||
    new Date(assignment.expiresAt).getTime() > now.getTime()
  )
}

export function resolveEffectiveAccessPolicyGrants(
  state: AccessPolicyAssignmentState,
  userId: string,
  now = new Date(),
): readonly EffectiveAccessPolicyGrant[] {
  const subject = resolveAuthorizationSubject(state, userId)
  if (!subject) return []

  return state.accessPolicies
    .filter((policy) => isAccessPolicyEffective(policy))
    .flatMap((policy): EffectiveAccessPolicyGrant[] => {
      const paths = state.accessPolicyAssignments
        .filter(
          (assignment) =>
            assignment.accessPolicyId === policy.id &&
            isAccessPolicyAssignmentEffective(assignment, now),
        )
        .flatMap((assignment): EffectiveAccessPolicyPath[] => {
          if (assignment.targetType === accessPolicyAssignmentTargets.user) {
            return assignment.targetId === subject.user.id
              ? [
                  {
                    type: "user",
                    targetId: assignment.targetId,
                    expiresAt: assignment.expiresAt,
                  },
                ]
              : []
          }
          if (
            assignment.targetType === accessPolicyAssignmentTargets.organization
          ) {
            return subject.organizationIds.has(assignment.targetId)
              ? [
                  {
                    type: "organization",
                    targetId: assignment.targetId,
                    expiresAt: assignment.expiresAt,
                  },
                ]
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
              expiresAt: assignment.expiresAt,
            })
          }
          for (const organizationId of role.organizationIds) {
            if (subject.organizationIds.has(organizationId)) {
              rolePaths.push({
                type: "role",
                targetId: role.id,
                viaOrganizationId: organizationId,
                expiresAt: assignment.expiresAt,
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
  input: AccessPolicyValue,
): AccessPolicyUpdateImpact {
  const assignments = state.accessPolicyAssignments.filter(
    (assignment) => assignment.accessPolicyId === policy.id,
  )
  const assignmentCounts: Record<AccessPolicyAssignmentTarget, number> = {
    user: 0,
    organization: 0,
    role: 0,
    application: 0,
  }
  for (const assignment of assignments) {
    assignmentCounts[assignment.targetType] += 1
  }
  const notificationRecipientUserIds = state.users.flatMap((user) => {
    const subject = resolveAuthorizationSubject(state, user.id)
    if (!subject) return []
    const receivesPolicy = assignments.some((assignment) =>
      assignment.targetType === accessPolicyAssignmentTargets.user
        ? assignment.targetId === subject.user.id
        : assignment.targetType === accessPolicyAssignmentTargets.organization
          ? subject.organizationIds.has(assignment.targetId)
          : assignment.targetType === accessPolicyAssignmentTargets.role
            ? subject.roleIds.has(assignment.targetId)
            : false,
    )
    return receivesPolicy ? [user.id] : []
  })
  const comparedResources = [
    ...policy.resources,
    ...input.resources.filter(
      (resource) =>
        !policy.resources.some((candidate) =>
          matchesResource(candidate, resource),
        ),
    ),
  ]
  const nextPolicy: AccessPolicy = {
    ...policy,
    ...input,
    name: input.name.trim(),
    description: input.description.trim(),
  }
  const nextState: AccessPolicyAssignmentState = {
    ...state,
    accessPolicies: state.accessPolicies.map((candidate) =>
      candidate.id === policy.id ? nextPolicy : candidate,
    ),
  }
  const now = new Date()
  const permissionChanges = notificationRecipientUserIds.flatMap((userId) => {
    const gainedResources: AccessPolicyResource[] = []
    const lostResources: AccessPolicyResource[] = []
    for (const resource of comparedResources) {
      const allowedBefore = hasEffectiveAccessPolicyResource(
        state,
        userId,
        resource,
        now,
      )
      const allowedAfter = hasEffectiveAccessPolicyResource(
        nextState,
        userId,
        resource,
        now,
      )
      if (!allowedBefore && allowedAfter) gainedResources.push(resource)
      if (allowedBefore && !allowedAfter) lostResources.push(resource)
    }
    return gainedResources.length > 0 || lostResources.length > 0
      ? [{ userId, gainedResources, lostResources }]
      : []
  })

  return {
    permissionChanges,
    notificationRecipientUserIds,
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
  now = new Date(),
): readonly string[] {
  const subject = resolveAuthorizationSubject(state, userId)
  if (!subject) return []
  const activePolicyIds = new Set(
    state.accessPolicies
      .filter((policy) => isAccessPolicyEffective(policy))
      .map((policy) => policy.id),
  )

  return [
    ...new Set(
      state.accessPolicyAssignments
        .filter(
          (assignment) =>
            activePolicyIds.has(assignment.accessPolicyId) &&
            isAccessPolicyAssignmentEffective(assignment, now) &&
            (assignment.targetType === accessPolicyAssignmentTargets.user
              ? assignment.targetId === subject.user.id
              : assignment.targetType ===
                  accessPolicyAssignmentTargets.organization
                ? subject.organizationIds.has(assignment.targetId)
                : assignment.targetType === accessPolicyAssignmentTargets.role
                  ? subject.roleIds.has(assignment.targetId)
                  : false),
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
  now = new Date(),
) {
  const assignedPolicyIds = new Set(
    resolveAssignedAccessPolicyIds(state, userId, now),
  )
  const matchingPolicies = state.accessPolicies.filter(
    (policy) =>
      isAccessPolicyEffective(policy) &&
      assignedPolicyIds.has(policy.id) &&
      policy.resources.some((candidate) =>
        matchesResource(candidate, resource),
      ),
  )
  return (
    matchingPolicies.some(
      (policy) => policy.effect === accessPolicyEffects.allow,
    ) &&
    !matchingPolicies.some(
      (policy) => policy.effect === accessPolicyEffects.deny,
    )
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
      isAccessPolicyEffective(candidate) && assignedPolicyIds.has(candidate.id),
  )

  return policy.resources.filter((resource) => {
    const matchingPolicies = assignedPolicies.filter((candidate) =>
      candidate.resources.some((candidateResource) =>
        matchesResource(candidateResource, resource),
      ),
    )
    if (policy.effect === accessPolicyEffects.deny) {
      return !matchingPolicies.some(
        (candidate) => candidate.effect === accessPolicyEffects.deny,
      )
    }
    return (
      !matchingPolicies.some(
        (candidate) => candidate.effect === accessPolicyEffects.allow,
      ) ||
      matchingPolicies.some(
        (candidate) => candidate.effect === accessPolicyEffects.deny,
      )
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
