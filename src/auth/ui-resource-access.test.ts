import { describe, expect, it } from "vitest"

import {
  resolveUiNamespaceAdministratorResourceIds,
  resolveUiResourceAccess,
} from "@/auth/ui-resource-access"
import { localFixture } from "@/mocks/fixture"
import {
  defaultPolicyOperatorRole,
  defaultUiNamespace,
  defaultUiResourceManagerRole,
} from "@/mocks/system-fixture"

function userId(nickname: string) {
  const user = localFixture.users.find(
    (candidate) => candidate.nickname === nickname,
  )
  if (!user) throw new Error(`Fixture user not found: ${nickname}`)
  return user.id
}

describe("UI resource management access", () => {
  it("limits namespace administrators to namespaces assigned to their role", () => {
    const state = structuredClone(localFixture)
    const otherNamespaceAdministratorRole = state.roles.find(
      (role) => role.id === defaultPolicyOperatorRole.id,
    )
    if (!otherNamespaceAdministratorRole) {
      throw new Error("Policy operator role is missing")
    }
    otherNamespaceAdministratorRole.userIds.push(userId("Emma"))
    state.uiNamespaces.push({
      id: "43000000-0000-4000-8000-000000000020",
      key: "customer-console",
      name: "Customer Console",
      description: "다른 시스템 관리자 범위를 검증합니다.",
      administratorRoleId: defaultPolicyOperatorRole.id,
      administratorAccessPolicyId: "43000000-0000-4000-8000-000000000021",
      status: "active",
      lastSyncedAt: null,
      createdAt: "2026-08-11T00:00:00.000Z",
    })
    state.accessPolicies.push({
      id: "43000000-0000-4000-8000-000000000021",
      name: "Customer Console 시스템 관리자 접근",
      description: "Customer Console 네임스페이스 접근을 허용합니다.",
      type: "access-grant",
      effect: "allow",
      resources: [
        {
          type: "ui-namespace",
          id: "43000000-0000-4000-8000-000000000020",
        },
      ],
      status: "active",
      createdAt: "2026-08-11T00:00:00.000Z",
    })
    state.accessPolicyAssignments.push({
      id: "43000000-0000-4000-8000-000000000022",
      accessPolicyId: "43000000-0000-4000-8000-000000000021",
      targetType: "role",
      targetId: defaultPolicyOperatorRole.id,
      createdAt: "2026-08-11T00:00:00.000Z",
    })
    const access = resolveUiResourceAccess(state, userId("David"))
    const otherNamespaceAdministratorAccess = resolveUiResourceAccess(
      state,
      userId("Emma"),
    )

    expect(access.administratorNamespaceIds).toEqual([defaultUiNamespace.id])
    expect(access.manageableNamespaceIds).toEqual([defaultUiNamespace.id])
    expect(otherNamespaceAdministratorAccess.administratorNamespaceIds).toEqual(
      ["43000000-0000-4000-8000-000000000020"],
    )
    expect(otherNamespaceAdministratorAccess.manageableNamespaceIds).toEqual([
      "43000000-0000-4000-8000-000000000020",
    ])
  })

  it("allows namespace policies assigned through a role", () => {
    const state = structuredClone(localFixture)
    const managerRole = state.roles.find(
      (role) => role.id === defaultUiResourceManagerRole.id,
    )
    if (!managerRole) throw new Error("UI resource manager role is missing")
    managerRole.userIds.push(userId("Emma"))
    const access = resolveUiResourceAccess(state, userId("Emma"))
    const generalUserAccess = resolveUiResourceAccess(state, userId("Daniel"))

    expect(access).toMatchObject({
      isManager: true,
      administratorNamespaceIds: [],
      manageableNamespaceIds: [defaultUiNamespace.id],
    })
    expect(generalUserAccess.manageableNamespaceIds).toEqual([])
  })

  it("does not infer namespace access from a management role alone", () => {
    const state = structuredClone(localFixture)
    const managerRole = state.roles.find(
      (role) => role.id === defaultUiResourceManagerRole.id,
    )
    if (!managerRole) throw new Error("UI resource manager role is missing")
    managerRole.userIds.push(userId("Emma"))
    const managerPolicyId = state.accessPolicyAssignments.find(
      (assignment) =>
        assignment.targetType === "role" &&
        assignment.targetId === defaultUiResourceManagerRole.id,
    )?.accessPolicyId
    const managerPolicy = state.accessPolicies.find(
      (policy) => policy.id === managerPolicyId,
    )
    if (!managerPolicy) throw new Error("UI resource manager policy is missing")
    managerPolicy.resources = managerPolicy.resources.filter(
      (resource) => resource.type !== "ui-namespace",
    )

    expect(
      resolveUiResourceAccess(state, userId("Emma")).manageableNamespaceIds,
    ).toEqual([])
  })

  it("reports resources missing from the namespace administrator policy", () => {
    const state = structuredClone(localFixture)
    const resource = state.uiResources.find(
      (candidate) =>
        candidate.namespaceId === defaultUiNamespace.id &&
        candidate.key === "uiResources:list:changeUiResourceStatus",
    )
    const policy = state.accessPolicies.find(
      (candidate) =>
        candidate.id === defaultUiNamespace.administratorAccessPolicyId,
    )
    if (!resource || !policy) {
      throw new Error("Namespace administrator access fixture is missing")
    }
    policy.resources = policy.resources.filter(
      (reference) =>
        reference.type !== "ui-resource" || reference.id !== resource.id,
    )

    expect(
      resolveUiNamespaceAdministratorResourceIds(state, defaultUiNamespace.id),
    ).not.toContain(resource.id)
  })
})
