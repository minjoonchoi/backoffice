import { describe, expect, it } from "vitest"

import {
  resolveOwnedCredentialIds,
  resolveUserCredentialHistory,
} from "@/features/credentials/credential-ownership"
import { localFixture } from "@/mocks/fixture"

function findUserId(nickname: string) {
  const user = localFixture.users.find(
    (candidate) => candidate.nickname === nickname,
  )
  if (!user) throw new Error(`Fixture user not found: ${nickname}`)
  return user.id
}

describe("credential ownership", () => {
  it("includes active credentials issued to the requester", () => {
    expect(
      resolveOwnedCredentialIds(localFixture, findUserId("Amelia")),
    ).toEqual(["80000000-0000-4000-8000-000000000001"])
  })

  it("does not treat administrator visibility as ownership", () => {
    expect(
      resolveOwnedCredentialIds(localFixture, findUserId("David")),
    ).toEqual([])
  })

  it("excludes inactive credentials and inactive users", () => {
    const state = structuredClone(localFixture)
    const credential = state.apiKeys[0]
    if (!credential) throw new Error("Credential fixture is missing")
    credential.status = "inactive"

    expect(resolveOwnedCredentialIds(state, findUserId("Amelia"))).toEqual([])
    expect(resolveOwnedCredentialIds(state, findUserId("Olivia"))).toEqual([])
  })

  it("returns all requests and current or historical credentials for a user", () => {
    const history = resolveUserCredentialHistory(
      localFixture,
      findUserId("Amelia"),
    )

    expect(history.requests.length).toBeGreaterThan(0)
    expect(
      history.requests.every(
        (request) => request.requesterId === findUserId("Amelia"),
      ),
    ).toBe(true)
    expect(history.credentials.map((credential) => credential.name)).toContain(
      "local-integration-key",
    )
  })
})
