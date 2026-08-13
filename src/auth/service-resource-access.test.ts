import { describe, expect, it } from "vitest"

import {
  canManageService,
  resolveServiceResourceAccess,
} from "@/auth/service-resource-access"
import { localFixture } from "@/mocks/fixture"
import { organizationLeaderGroup } from "@/mocks/system-fixture"

function findUserId(nickname: string) {
  const user = localFixture.users.find((item) => item.nickname === nickname)
  if (!user) throw new Error(`Fixture user not found: ${nickname}`)
  return user.id
}

function findOrganizationId(name: string) {
  const organization = localFixture.organizations.find(
    (item) => item.name === name,
  )
  if (!organization) throw new Error(`Fixture organization not found: ${name}`)
  return organization.id
}

function findService(name: string) {
  const service = localFixture.services.find((item) => item.name === name)
  if (!service) throw new Error(`Fixture service not found: ${name}`)
  return service
}

describe("service resource access", () => {
  it("lets a Backoffice administrator manage every organization", () => {
    const access = resolveServiceResourceAccess(
      localFixture,
      findUserId("David"),
    )

    expect(access.isAdministrator).toBe(true)
    expect(access.manageableOrganizationIds).toEqual(
      localFixture.organizations.map((organization) => organization.id),
    )
    expect(
      localFixture.services.every((service) =>
        canManageService(access, service),
      ),
    ).toBe(true)
  })

  it("limits a service owner to organizations they lead", () => {
    const access = resolveServiceResourceAccess(
      localFixture,
      findUserId("Emma"),
    )

    expect(access).toEqual({
      isAdministrator: false,
      isOrganizationLeader: true,
      manageableOrganizationIds: [findOrganizationId("개발 2팀")],
    })
    expect(canManageService(access, findService("Developer API"))).toBe(true)
    expect(canManageService(access, findService("협업 SaaS"))).toBe(false)
  })

  it("does not grant a scope to members or stale group members", () => {
    expect(
      resolveServiceResourceAccess(localFixture, findUserId("Amelia")),
    ).toEqual({
      isAdministrator: false,
      isOrganizationLeader: false,
      manageableOrganizationIds: [],
    })

    const state = structuredClone(localFixture)
    const leaderGroup = state.groups.find(
      (group) => group.id === organizationLeaderGroup.id,
    )
    if (!leaderGroup) throw new Error("Organization leader group is missing")
    leaderGroup.userIds.push(findUserId("Daniel"))

    expect(resolveServiceResourceAccess(state, findUserId("Daniel"))).toEqual({
      isAdministrator: false,
      isOrganizationLeader: true,
      manageableOrganizationIds: [],
    })
  })

  it("returns no management scope without an active local user", () => {
    expect(resolveServiceResourceAccess(localFixture, null)).toEqual({
      isAdministrator: false,
      isOrganizationLeader: false,
      manageableOrganizationIds: [],
    })
  })

  it("uses the system references delivered in the snapshot", () => {
    const state = structuredClone(localFixture)
    state.systemReferences = {
      ...state.systemReferences,
      roleIds: {
        ...state.systemReferences.roleIds,
        administrator: state.systemReferences.roleIds.generalUser,
      },
    }

    expect(
      resolveServiceResourceAccess(state, findUserId("Daniel")).isAdministrator,
    ).toBe(true)
  })
})
