import { describe, expect, it } from "vitest"

import { resolveCredentialVisibility } from "@/auth/credential-access"
import { resolveOwnedCredentialIds } from "@/features/credentials/credential-ownership"
import { localFixture } from "@/mocks/fixture"

function findUserId(nickname: string) {
  const user = localFixture.users.find((item) => item.nickname === nickname)
  if (!user) throw new Error(`Fixture user not found: ${nickname}`)
  return user.id
}

describe("credential visibility", () => {
  it("lets a Backoffice administrator view every request and credential", () => {
    const visibility = resolveCredentialVisibility(
      localFixture,
      findUserId("David"),
    )

    expect(visibility.requests).toHaveLength(1)
    expect(visibility.credentials).toHaveLength(1)
    expect(visibility.credentials[0]?.scopes).toContain("administrator")
    expect(
      resolveOwnedCredentialIds(localFixture, findUserId("David")),
    ).toEqual([])
  })

  it("lets the requester and service owner organization view the result", () => {
    const visibility = resolveCredentialVisibility(
      localFixture,
      findUserId("Amelia"),
    )

    expect(visibility.requests).toHaveLength(1)
    expect(visibility.credentials[0]?.scopes).toEqual([
      "requester",
      "serviceOwnerOrganization",
      "applicationOwnerOrganization",
    ])
  })

  it("hides unrelated credentials and inactive-user data", () => {
    expect(
      resolveCredentialVisibility(localFixture, findUserId("Daniel")),
    ).toEqual({ requests: [], credentials: [] })
    expect(
      resolveCredentialVisibility(localFixture, findUserId("Olivia")),
    ).toEqual({ requests: [], credentials: [] })
  })

  it("rejects inconsistent credential references", () => {
    const state = structuredClone(localFixture)
    const credential = state.apiKeys[0]
    const externalService = state.services.find(
      (service) => service.type === "external",
    )
    if (!credential || !externalService) {
      throw new Error("Credential consistency fixture is missing")
    }
    credential.serviceId = externalService.id

    expect(() =>
      resolveCredentialVisibility(state, findUserId("David")),
    ).toThrow("Credential service mismatch")
  })
})
