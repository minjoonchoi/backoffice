import { describe, expect, it } from "vitest"

import { createMockBackofficeApiClient } from "@/application/api/mock-api-client"
import { initialBackofficeState } from "@/mocks/system-fixture"
import { localFixture } from "@/mocks/fixture"

describe("mock backoffice API client", () => {
  it("handles request DTOs and exposes the changed data through a snapshot response", async () => {
    const client = createMockBackofficeApiClient({
      initialState: initialBackofficeState,
    })

    const result = await client.iam.createGroup({
      body: {
        name: "감사 담당자",
        description: "감사 업무 담당자를 연결합니다.",
      },
    })

    expect(result).toMatchObject({
      ok: true,
      value: { name: "감사 담당자" },
    })
    const snapshot = await client.getSnapshot({})
    expect(
      snapshot.data.groups.some((group) => group.name === "감사 담당자"),
    ).toBe(true)
  })

  it("rejects invalid request bodies without changing mock data", async () => {
    const client = createMockBackofficeApiClient({
      initialState: initialBackofficeState,
    })
    const before = await client.getSnapshot({})

    await expect(
      client.iam.createGroup({ body: { name: "x", description: "" } }),
    ).resolves.toEqual({ ok: false, error: "invalid-input" })
    await expect(client.getSnapshot({})).resolves.toEqual(before)
  })

  it("returns defensive snapshot copies", async () => {
    const client = createMockBackofficeApiClient({
      initialState: initialBackofficeState,
    })
    const first = await client.getSnapshot({})

    first.data.groups.splice(0)

    const second = await client.getSnapshot({})
    expect(second.data.groups).toHaveLength(
      initialBackofficeState.groups.length,
    )
    expect(second.data.systemReferences).toEqual(
      initialBackofficeState.systemReferences,
    )
    expect(second.data.systemReferences).not.toBe(
      initialBackofficeState.systemReferences,
    )
  })

  it("marks only the current user's notification as read", async () => {
    const client = createMockBackofficeApiClient({ initialState: localFixture })
    const snapshot = await client.getSnapshot({})
    const notification = snapshot.data.notifications.find(
      (item) => !item.readAt,
    )
    if (!notification) throw new Error("Unread notification fixture is missing")

    await expect(
      client.home.markNotificationRead({
        notificationId: notification.id,
        requesterId: notification.userId,
      }),
    ).resolves.toMatchObject({ ok: true, value: { id: notification.id } })
    const updated = await client.getSnapshot({})
    expect(
      updated.data.notifications.find((item) => item.id === notification.id)
        ?.readAt,
    ).not.toBeNull()
  })

  it("supports role policy assignment and prevents protected administrator policy revocation", async () => {
    const client = createMockBackofficeApiClient({ initialState: localFixture })
    const snapshot = await client.getSnapshot({})
    const administrator = snapshot.data.users.find(
      (user) => user.nickname === "David",
    )
    const policy = snapshot.data.accessPolicies.find(
      (candidate) => candidate.name === "운영 모니터링 허용",
    )
    if (!administrator || !policy)
      throw new Error("Policy fixture is incomplete")
    const created = await client.iam.createRole({
      body: { name: "감사 조회자", description: "감사 정책 검증 역할입니다." },
    })
    if (!created.ok) throw new Error(created.error)

    await expect(
      client.accessPolicies.assignAccessPoliciesToTarget({
        accessPolicyIds: [policy.id],
        targetType: "role",
        targetId: created.value.id,
        requesterId: administrator.id,
      }),
    ).resolves.toMatchObject({ ok: true })

    const administratorAssignment = snapshot.data.accessPolicyAssignments.find(
      (assignment) =>
        assignment.targetType === "role" &&
        assignment.targetId ===
          snapshot.data.systemReferences.roleIds.administrator,
    )
    if (!administratorAssignment) {
      throw new Error("Administrator assignment fixture is missing")
    }
    await expect(
      client.accessPolicies.unassignAccessPolicyFromTarget({
        assignmentId: administratorAssignment.id,
        requesterId: administrator.id,
      }),
    ).resolves.toEqual({ ok: false, error: "protected-relationship" })
  })

  it("updates and deletes an unused custom role", async () => {
    const client = createMockBackofficeApiClient({ initialState: localFixture })
    const snapshot = await client.getSnapshot({})
    const administrator = snapshot.data.users.find(
      (user) => user.nickname === "David",
    )
    if (!administrator) throw new Error("Administrator fixture is missing")
    const created = await client.iam.createRole({
      body: { name: "임시 역할", description: "수정 삭제 검증용 역할입니다." },
    })
    if (!created.ok) throw new Error(created.error)

    await expect(
      client.iam.updateRole({
        roleId: created.value.id,
        requesterId: administrator.id,
        body: { name: "변경 역할", description: "변경된 역할 설명입니다." },
      }),
    ).resolves.toMatchObject({ ok: true, value: { name: "변경 역할" } })
    await expect(
      client.iam.deleteRole({
        roleId: created.value.id,
        requesterId: administrator.id,
      }),
    ).resolves.toMatchObject({ ok: true })
  })
})
