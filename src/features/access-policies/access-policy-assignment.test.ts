import { describe, expect, it } from "vitest"

import {
  hasEffectiveAccessPolicyResource,
  hasEffectiveAccessPolicy,
  resolveAssignedAccessPolicyIds,
  resolveEffectiveAccessPolicyGrants,
  resolveAccessPolicyAssignmentAffectedUserIds,
  resolveAccessPolicyUpdateImpact,
  resolveMissingAccessPolicyResources,
} from "@/features/access-policies/access-policy-assignment"
import type {
  AccessPolicy,
  AccessPolicyAssignmentTarget,
} from "@/features/access-policies/model"
import { localFixture } from "@/mocks/fixture"

function findUser(nickname: string) {
  const user = localFixture.users.find(
    (candidate) => candidate.nickname === nickname,
  )
  if (!user) throw new Error(`Fixture user not found: ${nickname}`)
  return user
}

describe("assigned access policy resolution", () => {
  it.each<AccessPolicyAssignmentTarget>([
    "user",
    "organization",
    "role",
    "group",
  ])("includes a policy assigned through a %s target", (targetType) => {
    const state = structuredClone(localFixture)
    const user = findUser("David")
    const policy = state.accessPolicies.find((candidate) =>
      candidate.resources.some((resource) => resource.type === "ui-namespace"),
    )
    const namespaceResource = policy?.resources.find(
      (resource) => resource.type === "ui-namespace",
    )
    const targetId =
      targetType === "user"
        ? user.id
        : targetType === "organization"
          ? user.organizationIds[0]
          : targetType === "role"
            ? state.roles.find((role) => role.userIds.includes(user.id))?.id
            : state.groups.find((group) => group.userIds.includes(user.id))?.id
    if (!policy || !namespaceResource || !targetId)
      throw new Error("Assignment fixture is incomplete")
    state.accessPolicyAssignments = [
      {
        id: "99000000-0000-4000-8000-000000000001",
        accessPolicyId: policy.id,
        targetType,
        targetId,
        createdAt: "2026-08-11T00:00:00.000Z",
      },
    ]

    expect(resolveAssignedAccessPolicyIds(state, user.id)).toEqual([policy.id])
    expect(
      hasEffectiveAccessPolicyResource(state, user.id, namespaceResource),
    ).toBe(true)
  })

  it("excludes inactive policies and inactive users", () => {
    const state = structuredClone(localFixture)
    const user = findUser("David")
    const policy = state.accessPolicies[0]
    if (!policy) throw new Error("Policy fixture is missing")
    policy.status = "inactive"
    state.accessPolicyAssignments = [
      {
        id: "99000000-0000-4000-8000-000000000002",
        accessPolicyId: policy.id,
        targetType: "user",
        targetId: user.id,
        createdAt: "2026-08-11T00:00:00.000Z",
      },
    ]

    expect(resolveAssignedAccessPolicyIds(state, user.id)).toEqual([])
    expect(
      resolveAssignedAccessPolicyIds(state, findUser("Olivia").id),
    ).toEqual([])
  })

  it("distinguishes already owned and missing resources across policies", () => {
    const state = structuredClone(localFixture)
    const user = findUser("Daniel")
    const assignedPolicy = state.accessPolicies.find(
      (policy) => policy.name === "Backoffice 일반 사용자 UI 접근",
    )
    const missingResource = state.accessPolicies
      .find((policy) => policy.name === "Backoffice 시스템 관리자 UI 접근")
      ?.resources.find(
        (resource) =>
          !assignedPolicy?.resources.some(
            (candidate) =>
              candidate.type === resource.type && candidate.id === resource.id,
          ),
      )
    const ownedResource = assignedPolicy?.resources[0]
    if (!assignedPolicy || !ownedResource || !missingResource) {
      throw new Error("Policy coverage fixture is incomplete")
    }
    const candidate = {
      ...assignedPolicy,
      id: "99000000-0000-4000-8000-000000000010",
      resources: [ownedResource, missingResource],
    }

    expect(
      resolveMissingAccessPolicyResources(state, user.id, candidate),
    ).toEqual([missingResource])
    expect(hasEffectiveAccessPolicy(state, user.id, candidate)).toBe(false)

    candidate.resources = [ownedResource]
    expect(hasEffectiveAccessPolicy(state, user.id, candidate)).toBe(true)
  })

  it("treats a deny policy as missing coverage for an allow request", () => {
    const state = structuredClone(localFixture)
    const user = findUser("Daniel")
    const assignedPolicy = state.accessPolicies.find(
      (policy) => policy.name === "Backoffice 일반 사용자 UI 접근",
    )
    const resource = assignedPolicy?.resources[0]
    if (!assignedPolicy || !resource) {
      throw new Error("Policy coverage fixture is incomplete")
    }
    const denyPolicy: AccessPolicy = {
      ...assignedPolicy,
      id: "99000000-0000-4000-8000-000000000011",
      name: "테스트 거부",
      effect: "deny",
      resources: [resource],
    }
    state.accessPolicies.push(denyPolicy)
    state.accessPolicyAssignments.push({
      id: "99000000-0000-4000-8000-000000000012",
      accessPolicyId: denyPolicy.id,
      targetType: "user",
      targetId: user.id,
      createdAt: "2026-08-11T00:00:00.000Z",
    })

    expect(
      resolveMissingAccessPolicyResources(state, user.id, {
        ...assignedPolicy,
        resources: [resource],
      }),
    ).toEqual([resource])
  })

  it("reports every direct and inherited grant path", () => {
    const state = structuredClone(localFixture)
    const user = findUser("David")
    const policy = state.accessPolicies.find(
      (candidate) => candidate.name === "Backoffice 시스템 관리자 UI 접근",
    )
    const role = state.roles.find((candidate) =>
      candidate.userIds.includes(user.id),
    )
    const organizationId = user.organizationIds[0]
    if (!policy || !role || !organizationId) {
      throw new Error("Effective policy fixture is incomplete")
    }
    role.organizationIds.push(organizationId)

    const grant = resolveEffectiveAccessPolicyGrants(state, user.id).find(
      (candidate) => candidate.policy.id === policy.id,
    )

    expect(grant?.paths).toEqual(
      expect.arrayContaining([
        { type: "role", targetId: role.id, viaOrganizationId: null },
        {
          type: "role",
          targetId: role.id,
          viaOrganizationId: organizationId,
        },
      ]),
    )
  })

  it("excludes users who retain the same policy through another assignment", () => {
    const state = structuredClone(localFixture)
    const user = findUser("David")
    const assignment = state.accessPolicyAssignments.find(
      (candidate) =>
        candidate.targetType === "role" &&
        state.roles
          .find((role) => role.id === candidate.targetId)
          ?.userIds.includes(user.id),
    )
    if (!assignment) throw new Error("Policy assignment fixture is incomplete")
    state.accessPolicyAssignments.push({
      id: "99000000-0000-4000-8000-000000000020",
      accessPolicyId: assignment.accessPolicyId,
      targetType: "user",
      targetId: user.id,
      createdAt: "2026-08-11T00:00:00.000Z",
    })

    expect(
      resolveAccessPolicyAssignmentAffectedUserIds(state, assignment.id),
    ).not.toContain(user.id)
  })

  it("summarizes policy changes, assignment paths, and affected users", () => {
    const state = structuredClone(localFixture)
    const assignment = state.accessPolicyAssignments[0]
    const policy = state.accessPolicies.find(
      (candidate) => candidate.id === assignment?.accessPolicyId,
    )
    if (!assignment || !policy) {
      throw new Error("Policy impact fixture is incomplete")
    }
    const replacementResource = state.uiResources.find(
      (resource) =>
        !policy.resources.some(
          (candidate) =>
            candidate.type === "ui-resource" && candidate.id === resource.id,
        ),
    )
    if (!replacementResource) {
      throw new Error("Replacement UI resource fixture is missing")
    }

    const impact = resolveAccessPolicyUpdateImpact(state, policy, {
      ...policy,
      name: `${policy.name} 변경`,
      effect: policy.effect === "allow" ? "deny" : "allow",
      resources: [
        ...policy.resources.slice(1),
        { type: "ui-resource", id: replacementResource.id },
      ],
    })

    expect(impact.nameChanged).toBe(true)
    expect(impact.effectChanged).toBe(true)
    expect(impact.addedResources).toEqual([
      { type: "ui-resource", id: replacementResource.id },
    ])
    expect(impact.removedResources).toEqual([policy.resources[0]])
    expect(impact.assignmentCounts[assignment.targetType]).toBeGreaterThan(0)
    expect(impact.affectedUserIds.length).toBeGreaterThan(0)
  })
})
