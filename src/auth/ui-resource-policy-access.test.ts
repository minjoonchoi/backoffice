import { describe, expect, it } from "vitest"

import {
  resolveUiResourceAssignmentTargets,
  resolveUiResourcePolicyAccess,
} from "@/auth/ui-resource-policy-access"
import { localFixture } from "@/mocks/fixture"

function userId(nickname: string) {
  const user = localFixture.users.find(
    (candidate) => candidate.nickname === nickname,
  )
  if (!user) throw new Error(`Fixture user not found: ${nickname}`)
  return user.id
}

function resourceId(key: string) {
  const resource = localFixture.uiResources.find(
    (candidate) => candidate.key === key,
  )
  if (!resource) throw new Error(`Fixture UI resource not found: ${key}`)
  return resource.id
}

describe("UI resource policy access", () => {
  it("resolves role and group policies and inherits parent resources", () => {
    const access = resolveUiResourcePolicyAccess(localFixture, userId("Emma"))

    expect(access.resourceKeys).toContain("services:list:createService")
    expect(access.resourceKeys).toContain("services")
    expect(access.resourceKeys).not.toContain(
      "approvalLines:detail:updateRequestTemplate",
    )
  })

  it("applies a deny policy to the resource and every descendant", () => {
    const state = structuredClone(localFixture)
    const denyPolicyId = crypto.randomUUID()
    state.accessPolicies.push({
      id: denyPolicyId,
      name: "서비스 UI 거부",
      description: "서비스 UI 전체를 거부합니다.",
      type: "access-grant",
      effect: "deny",
      resources: [{ type: "ui-resource", id: resourceId("services") }],
      status: "active",
      createdAt: "2026-08-11T00:00:00.000Z",
    })
    state.accessPolicyAssignments.push({
      id: crypto.randomUUID(),
      accessPolicyId: denyPolicyId,
      targetType: "user",
      targetId: userId("David"),
      createdAt: "2026-08-11T00:00:00.000Z",
    })

    const keys = resolveUiResourcePolicyAccess(
      state,
      userId("David"),
    ).resourceKeys
    expect(keys).not.toContain("services")
    expect(keys).not.toContain("services:list:createService")
    expect(keys).toContain("serviceEndpoints:list")
  })

  it("ignores inactive policies, inactive namespaces, and orphan resources", () => {
    const inactivePolicyState = structuredClone(localFixture)
    const generalUserPolicy = inactivePolicyState.accessPolicies.find(
      (policy) => policy.name === "Backoffice 일반 사용자 UI 접근",
    )
    if (!generalUserPolicy) {
      throw new Error("General user UI access policy is missing")
    }
    generalUserPolicy.status = "inactive"
    expect(
      resolveUiResourcePolicyAccess(inactivePolicyState, userId("Daniel"))
        .resourceKeys,
    ).not.toContain("services")

    const orphanState = structuredClone(localFixture)
    const createService = orphanState.uiResources.find(
      (resource) => resource.key === "services:list:createService",
    )
    if (!createService) throw new Error("Create service resource is missing")
    createService.orphanedAt = "2026-08-11T01:00:00.000Z"
    expect(
      resolveUiResourcePolicyAccess(orphanState, userId("David")).resourceKeys,
    ).not.toContain("services:list:createService")

    const inactiveNamespaceState = structuredClone(localFixture)
    const namespace = inactiveNamespaceState.uiNamespaces[0]
    if (!namespace) throw new Error("UI namespace is missing")
    namespace.status = "inactive"
    expect(
      resolveUiResourcePolicyAccess(inactiveNamespaceState, userId("David"))
        .resourceKeys,
    ).toEqual([])
  })

  it("ignores inactive resources and active descendants of inactive parents", () => {
    const state = structuredClone(localFixture)
    const services = state.uiResources.find(
      (resource) => resource.key === "services",
    )
    const createService = state.uiResources.find(
      (resource) => resource.key === "services:list:createService",
    )
    if (!services || !createService) {
      throw new Error("Service UI resource fixtures are missing")
    }
    services.status = "inactive"

    const keys = resolveUiResourcePolicyAccess(
      state,
      userId("David"),
    ).resourceKeys

    expect(createService.status).toBe("active")
    expect(keys).not.toContain("services")
    expect(keys).not.toContain("services:list:createService")
    expect(keys).toContain("serviceEndpoints:list")
  })

  it("returns no UI resources for resigned and unknown users", () => {
    expect(
      resolveUiResourcePolicyAccess(localFixture, userId("Noah")).resourceKeys,
    ).toEqual([])
    expect(
      resolveUiResourcePolicyAccess(localFixture, crypto.randomUUID())
        .resourceKeys,
    ).toEqual([])
  })

  it("derives management targets from policy assignments", () => {
    const targets = resolveUiResourceAssignmentTargets(
      localFixture,
      "services:list:createService",
    )

    expect(targets.roleIds).toContain(
      localFixture.systemReferences.roleIds.administrator,
    )
    expect(targets.groupIds).toContain(
      localFixture.systemReferences.groupIds.organizationLeader,
    )
  })
})
