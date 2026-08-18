import { describe, expect, it } from "vitest"

import { resolveRequestOrganizationLeader } from "@/features/request-templates/approval-assignee"
import { localFixture } from "@/mocks/fixture"

function userId(nickname: string) {
  const user = localFixture.users.find((item) => item.nickname === nickname)
  if (!user) throw new Error(`Fixture user not found: ${nickname}`)
  return user.id
}

function organizationId(name: string) {
  const organization = localFixture.organizations.find(
    (item) => item.name === name,
  )
  if (!organization) throw new Error(`Fixture organization not found: ${name}`)
  return organization.id
}

describe("resolveRequestOrganizationLeader", () => {
  it("uses the selected organization leader for a team member", () => {
    const resolved = resolveRequestOrganizationLeader(
      localFixture,
      organizationId("개발 1팀"),
      userId("Owen"),
    )

    expect(resolved).toMatchObject({
      organization: { name: "개발 1팀" },
      leader: { nickname: "David" },
    })
  })

  it("uses the first upper organization leader when the requester leads the selected organization", () => {
    const resolved = resolveRequestOrganizationLeader(
      localFixture,
      organizationId("개발 1팀"),
      userId("David"),
    )

    expect(resolved).toMatchObject({
      organization: { name: "개발실" },
      leader: { nickname: "Jhonny" },
    })
  })

  it("returns no assignee when no different upper leader exists", () => {
    expect(
      resolveRequestOrganizationLeader(
        localFixture,
        organizationId("개발실"),
        userId("Jhonny"),
      ),
    ).toBeUndefined()
  })
})
