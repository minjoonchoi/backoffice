import { describe, expect, it } from "vitest"

import { resolveOrganizationMembershipRemovalImpact } from "@/features/iam/relationship-impact"
import { localFixture } from "@/mocks/fixture"

describe("organization membership removal impact", () => {
  it("blocks removal of an employed user's final organization", () => {
    const user = localFixture.users.find(
      (candidate) =>
        candidate.employmentStatus === "employed" &&
        candidate.organizationIds.length === 1,
    )
    const organizationId = user?.organizationIds[0]
    if (!user || !organizationId) throw new Error("User fixture is incomplete")

    expect(
      resolveOrganizationMembershipRemovalImpact(
        localFixture,
        user.id,
        organizationId,
      ).blocked,
    ).toBe(true)
  })

  it("reports role and policy loss after removing an organization path", () => {
    const state = structuredClone(localFixture)
    const user = state.users.find((candidate) => candidate.nickname === "Owen")
    const organizationId = user?.organizationIds[0]
    const role = state.roles.find(
      (candidate) => candidate.name === "Backoffice 정책 운영자",
    )
    const secondOrganization = state.organizations.find(
      (organization) => organization.id !== organizationId,
    )
    if (!user || !organizationId || !role || !secondOrganization) {
      throw new Error("Relationship fixture is incomplete")
    }
    role.userIds = role.userIds.filter((userId) => userId !== user.id)
    user.organizationIds.push(secondOrganization.id)
    role.organizationIds.push(organizationId)

    const impact = resolveOrganizationMembershipRemovalImpact(
      state,
      user.id,
      organizationId,
    )

    expect(impact.blocked).toBe(false)
    expect(impact.lostRoleIds).toContain(role.id)
    expect(impact.lostPolicyIds.length).toBeGreaterThan(0)
  })
})
