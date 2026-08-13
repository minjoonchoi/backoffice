import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"

import {
  SessionAccessProvider,
  useSessionAccess,
} from "@/auth/session-access-provider"
import { menuDefinitions, uiResourceKeys } from "@/config/menu-registry"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { BackofficeProvider, useBackoffice } from "@/application/state/provider"

function SessionAccessWrapper({ children }: { children: ReactNode }) {
  return (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={localDefaultUserId}
      >
        {children}
      </SessionAccessProvider>
    </BackofficeProvider>
  )
}

describe("SessionAccessProvider", () => {
  it("switches users and recalculates direct role access", () => {
    const { result } = renderHook(() => useSessionAccess(), {
      wrapper: SessionAccessWrapper,
    })
    const emma = localFixture.users.find((user) => user.nickname === "Emma")
    if (!emma) throw new Error("Emma fixture is missing")

    expect(result.current.currentUser?.nickname).toBe("David")
    expect(result.current.ownedCredentialIds).toEqual([])
    expect(result.current.accessibleMenuIds).toHaveLength(
      menuDefinitions.length,
    )
    expect(
      result.current.canAccessUiResource(
        "approvalLines:detail:updateRequestTemplate",
      ),
    ).toBe(true)
    expect(
      result.current.canAccessUiResource(
        uiResourceKeys.services.list.actions.createService,
      ),
    ).toBe(true)

    let switched = false
    act(() => {
      switched = result.current.switchUser(emma.id)
    })

    expect(switched).toBe(true)
    expect(result.current.currentUser?.nickname).toBe("Emma")
    expect(result.current.organizationNames).toEqual(["개발 2팀"])
    expect(result.current.effectiveRoles.map((role) => role.name)).toEqual([
      "Backoffice 일반 사용자",
    ])
    expect(result.current.groupNames).toEqual(["조직장 그룹"])
    expect(result.current.assignedAccessPolicyIds.length).toBeGreaterThan(0)
    expect(result.current.accessibleMenuIds).toEqual([
      "home",
      "approvalDocuments",
      "services",
      "serviceEndpoints",
      "apiKeys",
    ])
    expect(
      result.current.canAccessUiResource(
        uiResourceKeys.services.list.actions.createService,
      ),
    ).toBe(true)
    expect(
      result.current.canAccessUiResource(
        "approvalLines:detail:updateRequestTemplate",
      ),
    ).toBe(false)
  })

  it("recalculates assigned policies and owned credentials with the user", () => {
    const { result } = renderHook(() => useSessionAccess(), {
      wrapper: SessionAccessWrapper,
    })
    const amelia = localFixture.users.find((user) => user.nickname === "Amelia")
    const charlotte = localFixture.users.find(
      (user) => user.nickname === "Charlotte",
    )
    const assignedPolicy = localFixture.accessPolicies.find(
      (policy) => policy.name === "운영 모니터링 허용",
    )
    const credential = localFixture.apiKeys[0]
    if (!amelia || !charlotte || !assignedPolicy || !credential) {
      throw new Error("Session entitlement fixture is incomplete")
    }

    act(() => {
      result.current.switchUser(charlotte.id)
    })
    expect(result.current.assignedAccessPolicyIds).toContain(assignedPolicy.id)

    act(() => {
      result.current.switchUser(amelia.id)
    })
    expect(result.current.ownedCredentialIds).toEqual([credential.id])
    expect(result.current.ownedCredentialServiceIds).toEqual([
      credential.serviceId,
    ])
  })

  it("rejects unknown external user identifiers", () => {
    const { result } = renderHook(() => useSessionAccess(), {
      wrapper: SessionAccessWrapper,
    })

    expect(result.current.switchUser("unknown")).toBe(false)
    expect(
      result.current.switchUser("90000000-0000-4000-8000-000000000001"),
    ).toBe(false)
    expect(result.current.currentUser?.nickname).toBe("David")
  })

  it("keeps client-created users outside the server-backed login options", async () => {
    const { result } = renderHook(
      () => ({
        backoffice: useBackoffice(),
        session: useSessionAccess(),
      }),
      { wrapper: SessionAccessWrapper },
    )
    const organizationId = localFixture.organizations[0]?.id
    if (!organizationId) throw new Error("Organization fixture is missing")

    const created = await act(() =>
      result.current.backoffice.createUser({
        nickname: "Mason",
        email: "mason@example.com",
        employmentStatus: "employed",
        organizationIds: [organizationId],
      }),
    )
    expect(created.ok).toBe(true)
    if (!created.ok) return

    expect(
      result.current.session.userOptions.some(
        (user) => user.id === created.value.id,
      ),
    ).toBe(false)
    expect(result.current.session.switchUser(created.value.id)).toBe(false)
    expect(result.current.session.currentUser?.nickname).toBe("David")
  })
})
