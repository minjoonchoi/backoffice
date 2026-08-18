import { describe, expect, it } from "vitest"

import { resolveUiResourceAccess } from "@/auth/ui-resource-access"
import { localFixture } from "@/mocks/fixture"
import {
  defaultNamespace,
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
  it("limits namespace management to the configured management role", () => {
    expect(
      resolveUiResourceAccess(localFixture, userId("Owen"))
        .manageableNamespaceIds,
    ).toEqual([defaultNamespace.id])
    expect(
      resolveUiResourceAccess(localFixture, userId("Daniel"))
        .manageableNamespaceIds,
    ).toEqual([])
  })

  it("inherits the namespace management role through an organization", () => {
    const state = structuredClone(localFixture)
    const manager = state.users.find((user) => user.nickname === "Owen")
    const managerRole = state.roles.find(
      (role) => role.id === defaultUiResourceManagerRole.id,
    )
    if (!manager || !managerRole)
      throw new Error("Management fixture is missing")
    managerRole.userIds = managerRole.userIds.filter((id) => id !== manager.id)
    managerRole.organizationIds = [...manager.organizationIds]

    expect(
      resolveUiResourceAccess(state, manager.id).manageableNamespaceIds,
    ).toEqual([defaultNamespace.id])
  })

  it("excludes inactive namespaces", () => {
    const state = structuredClone(localFixture)
    state.namespaces = state.namespaces.map((namespace) => ({
      ...namespace,
      status: "inactive",
    }))

    expect(
      resolveUiResourceAccess(state, userId("Owen")).manageableNamespaceIds,
    ).toEqual([])
  })
})
