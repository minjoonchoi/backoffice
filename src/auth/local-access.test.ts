import { describe, expect, it } from "vitest"

import { resolveBackofficeAccess } from "@/auth/local-access"
import { resolveUiResourcePolicyAccess } from "@/auth/ui-resource-policy-access"
import { menuDefinitions, uiResourceKeys } from "@/config/menu-registry"
import { localFixture } from "@/mocks/fixture"
import {
  defaultBackofficeAdminRole,
  defaultGeneralUserRole,
  defaultIamOperatorRole,
  defaultPolicyOperatorRole,
  defaultServiceOperatorRole,
  defaultUiResourceManagerRole,
} from "@/mocks/system-fixture"

function findUserId(nickname: string) {
  const user = localFixture.users.find((item) => item.nickname === nickname)
  if (!user) throw new Error(`Fixture user not found: ${nickname}`)
  return user.id
}

describe("local backoffice access", () => {
  it("grants every managed menu to the administrator role", () => {
    const access = resolveBackofficeAccess(localFixture, findUserId("David"))

    expect(access.menuIds).toEqual(menuDefinitions.map((menu) => menu.id))

    expect(access.roleIds).toEqual([
      defaultBackofficeAdminRole.id,
      defaultIamOperatorRole.id,
      defaultGeneralUserRole.id,
      defaultServiceOperatorRole.id,
    ])

    const memberAccess = resolveBackofficeAccess(
      localFixture,
      findUserId("Owen"),
    )
    expect(memberAccess.roleIds).toEqual([
      defaultPolicyOperatorRole.id,
      defaultIamOperatorRole.id,
      defaultGeneralUserRole.id,
      defaultUiResourceManagerRole.id,
    ])
    expect(memberAccess.menuIds).toEqual([
      "home",
      "users",
      "organizations",
      "roles",
      "applications",
      "approvalDocuments",
      "services",
      "serviceEndpoints",
      "apiKeys",
      "uiResources",
    ])
    const administratorUiAccess = resolveUiResourcePolicyAccess(
      localFixture,
      findUserId("David"),
    )
    const policyOperatorUiAccess = resolveUiResourcePolicyAccess(
      localFixture,
      findUserId("Owen"),
    )
    expect(administratorUiAccess.resourceKeys).toContain(
      uiResourceKeys.approvalDocuments.list.actions.analyzePolicyConflicts,
    )
    expect(policyOperatorUiAccess.resourceKeys).not.toContain(
      uiResourceKeys.approvalDocuments.list.actions.analyzePolicyConflicts,
    )
    expect(policyOperatorUiAccess.resourceKeys).toContain(
      uiResourceKeys.approvalDocuments.list.actions.simulatePolicyAccess,
    )
    expect(access.menuIds).toContain(uiResourceKeys.requests.key)
    expect(memberAccess.menuIds).not.toContain(uiResourceKeys.requests.key)
  })

  it("hides menus whose root UI resource is inactive", () => {
    const state = structuredClone(localFixture)
    const requestTemplatesResource = state.uiResources.find(
      (resource) => resource.key === uiResourceKeys.approvalLines.key,
    )
    if (!requestTemplatesResource) {
      throw new Error("Request templates UI resource fixture is missing")
    }
    requestTemplatesResource.status = "inactive"

    expect(
      resolveBackofficeAccess(state, findUserId("David")).menuIds,
    ).not.toContain("approvalLines")
  })

  it("grants catalog and request read access through the general user role", () => {
    const directAccess = resolveBackofficeAccess(
      localFixture,
      findUserId("Benjamin"),
    )
    const inheritedAccess = resolveBackofficeAccess(
      localFixture,
      findUserId("Evelyn"),
    )

    expect(directAccess.roleIds).toEqual([
      defaultGeneralUserRole.id,
      defaultServiceOperatorRole.id,
    ])
    expect(inheritedAccess.roleIds).toEqual([defaultGeneralUserRole.id])
    expect(inheritedAccess.menuIds).toEqual([
      "home",
      "approvalDocuments",
      "services",
      "serviceEndpoints",
      "apiKeys",
    ])
  })

  it("grants every general-user menu without roles", () => {
    const access = resolveBackofficeAccess(localFixture, findUserId("Daniel"))

    expect(access).toEqual({
      roleIds: [defaultGeneralUserRole.id],
      menuIds: [
        "home",
        "approvalDocuments",
        "services",
        "serviceEndpoints",
        "apiKeys",
      ],
    })
  })

  it("honors a bundled UI policy assigned directly to an organization", () => {
    const development2Id = localFixture.organizations.find(
      (organization) => organization.name === "개발 2팀",
    )?.id
    if (!development2Id) throw new Error("Development team fixture is missing")

    const state = structuredClone(localFixture)
    const requestTemplateResourceKeys = new Set<string>([
      uiResourceKeys.approvalLines.key,
      uiResourceKeys.approvalLines.list.key,
      uiResourceKeys.approvalLines.detail.key,
    ])
    const requestTemplateResources = state.uiResources.filter((resource) =>
      requestTemplateResourceKeys.has(resource.key),
    )
    if (requestTemplateResources.length !== 3) {
      throw new Error("Request template UI resources are missing")
    }
    const policyId = crypto.randomUUID()
    state.accessPolicies.push({
      id: policyId,
      name: "요청 템플릿 조회 UI 접근",
      description: "요청 템플릿의 메뉴, 목록과 상세 화면을 함께 허용합니다.",
      type: "access-grant",
      managementType: "operator-managed",
      effect: "allow",
      resources: requestTemplateResources.map((resource) => ({
        type: "ui-resource",
        id: resource.id,
      })),
      status: "active",
      createdAt: "2026-08-11T00:00:00.000Z",
    })
    state.accessPolicyAssignments.push({
      id: crypto.randomUUID(),
      accessPolicyId: policyId,
      targetType: "organization",
      targetId: development2Id,
      expiresAt: null,
      createdAt: "2026-08-11T00:00:00.000Z",
    })

    const access = resolveBackofficeAccess(state, findUserId("Amelia"))

    expect(access.roleIds).toEqual([defaultGeneralUserRole.id])
    expect(access.menuIds).toEqual([
      "home",
      "approvalLines",
      "approvalDocuments",
      "services",
      "serviceEndpoints",
      "apiKeys",
    ])
  })

  it("keeps organization leaders out of IAM while preserving operational access", () => {
    const access = resolveBackofficeAccess(localFixture, findUserId("Emma"))

    expect(access.roleIds).toEqual([
      defaultGeneralUserRole.id,
      localFixture.systemReferences.roleIds.serviceOperator,
    ])
    expect(access.menuIds).toEqual([
      "home",
      "approvalDocuments",
      "services",
      "serviceEndpoints",
      "apiKeys",
    ])
    const uiAccess = resolveUiResourcePolicyAccess(
      localFixture,
      findUserId("Emma"),
    ).resourceKeys
    expect(uiAccess).toContain(
      uiResourceKeys.services.list.actions.createService,
    )
    expect(uiAccess).not.toContain(uiResourceKeys.roles.list.actions.createRole)
  })

  it("removes a menu when a matching deny policy applies", () => {
    const state = structuredClone(localFixture)
    const danielId = findUserId("Daniel")
    const usersResource = state.uiResources.find(
      (resource) => resource.key === "users",
    )
    if (!usersResource) throw new Error("Users UI resource is missing")
    const policyId = crypto.randomUUID()
    state.accessPolicies.push({
      id: policyId,
      name: "사용자 메뉴 거부",
      description: "사용자 메뉴와 하위 기능을 거부합니다.",
      type: "access-grant",
      managementType: "operator-managed",
      effect: "deny",
      resources: [{ type: "ui-resource", id: usersResource.id }],
      status: "active",
      createdAt: "2026-08-11T00:00:00.000Z",
    })
    state.accessPolicyAssignments.push({
      id: crypto.randomUUID(),
      accessPolicyId: policyId,
      targetType: "user",
      targetId: danielId,
      expiresAt: null,
      createdAt: "2026-08-11T00:00:00.000Z",
    })

    expect(resolveBackofficeAccess(state, danielId).menuIds).not.toContain(
      "users",
    )
  })

  it("hides a menu when its default list view is denied", () => {
    const state = structuredClone(localFixture)
    const davidId = findUserId("David")
    const usersList = state.uiResources.find(
      (resource) => resource.key === "users:list",
    )
    if (!usersList) throw new Error("Users list UI resource is missing")
    const policyId = crypto.randomUUID()
    state.accessPolicies.push({
      id: policyId,
      name: "사용자 목록 화면 거부",
      description: "사용자 상세 화면과 분리하여 목록 화면만 거부합니다.",
      type: "access-grant",
      managementType: "operator-managed",
      effect: "deny",
      resources: [{ type: "ui-resource", id: usersList.id }],
      status: "active",
      createdAt: "2026-08-11T00:00:00.000Z",
    })
    state.accessPolicyAssignments.push({
      id: crypto.randomUUID(),
      accessPolicyId: policyId,
      targetType: "user",
      targetId: davidId,
      expiresAt: null,
      createdAt: "2026-08-11T00:00:00.000Z",
    })

    const resourceKeys = resolveUiResourcePolicyAccess(
      state,
      davidId,
    ).resourceKeys
    expect(resourceKeys).not.toContain("users:list")
    expect(resourceKeys).toContain("users:detail")
    expect(resolveBackofficeAccess(state, davidId).menuIds).not.toContain(
      "users",
    )
  })

  it("rejects inactive and unknown users", () => {
    expect(resolveBackofficeAccess(localFixture, findUserId("Noah"))).toEqual({
      roleIds: [],
      menuIds: [],
    })
    expect(
      resolveBackofficeAccess(
        localFixture,
        "90000000-0000-4000-8000-000000000001",
      ),
    ).toEqual({ roleIds: [], menuIds: [] })
  })
})
