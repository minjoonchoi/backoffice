import { describe, expect, it } from "vitest"

import {
  applicationDeletionBlockers,
  resolveApplicationDeletionBlocker,
  resolveApplicationResourceAccess,
} from "@/features/iam/application-access"
import { localFixture } from "@/mocks/fixture"

function userId(nickname: string) {
  const user = localFixture.users.find(
    (candidate) => candidate.nickname === nickname,
  )
  if (!user) throw new Error(`Application access user not found: ${nickname}`)
  return user.id
}

describe("application resource access", () => {
  it("limits a general user to applications owned by their organizations", () => {
    const access = resolveApplicationResourceAccess(
      localFixture,
      userId("Emma"),
    )

    expect(access.ownerOrganizations.map((item) => item.name)).toEqual([
      "개발 2팀",
    ])
    expect(access.applications.map((item) => item.name)).toEqual([
      "Developer Console",
    ])
  })

  it("allows an IAM operator to manage applications for every organization", () => {
    const access = resolveApplicationResourceAccess(
      localFixture,
      userId("Owen"),
    )

    expect(access.ownerOrganizations).toHaveLength(
      localFixture.organizations.length,
    )
    expect(access.applications).toHaveLength(localFixture.applications.length)
  })

  it("returns no scope without an employed session user", () => {
    expect(resolveApplicationResourceAccess(localFixture, null)).toEqual({
      applications: [],
      ownerOrganizations: [],
    })
    expect(
      resolveApplicationResourceAccess(localFixture, userId("Olivia")),
    ).toEqual({ applications: [], ownerOrganizations: [] })
  })

  it("blocks deletion when an application has a valid credential", () => {
    const application = localFixture.applications.find(
      (candidate) => candidate.name === "Developer Console",
    )
    if (!application) throw new Error("Application fixture is missing")

    expect(
      resolveApplicationDeletionBlocker(localFixture, application.id),
    ).toBe(applicationDeletionBlockers.activeCredential)
  })
})
