import { describe, expect, it } from "vitest"

import { createAuditEvents } from "@/features/audit/audit-history"
import { localFixture } from "@/mocks/fixture"

describe("createAuditEvents", () => {
  it("records actor, before and after values, and effective permission impact", () => {
    const actor = localFixture.users.find((user) => user.nickname === "David")
    const role = localFixture.roles.find(
      (candidate) => candidate.userIds.length > 0,
    )
    const additionalUser = localFixture.users.find(
      (user) => role && !role.userIds.includes(user.id),
    )
    if (!actor || !role || !additionalUser) {
      throw new Error("Audit fixture is incomplete")
    }
    const next = structuredClone(localFixture)
    next.roles = next.roles.map((candidate) =>
      candidate.id === role.id
        ? {
            ...candidate,
            userIds: [...candidate.userIds, additionalUser.id],
          }
        : candidate,
    )

    const events = createAuditEvents(localFixture, next, actor.id)
    const event = events.find(
      (candidate) =>
        candidate.resourceType === "role" && candidate.targetId === role.id,
    )

    expect(event).toMatchObject({
      actorUserId: actor.id,
      action: "updated",
      targetName: role.name,
    })
    expect(event?.changes.some((change) => change.field === "userIds")).toBe(
      true,
    )
    expect(event?.impact.permissionChangedUserIds).toContain(additionalUser.id)
  })

  it("does not include credential secret storage coordinates in snapshots", () => {
    const credential = localFixture.apiKeys[0]
    if (!credential) throw new Error("Credential fixture is missing")
    const next = structuredClone(localFixture)
    next.apiKeys = next.apiKeys.map((candidate) =>
      candidate.id === credential.id
        ? { ...candidate, usageSystemNames: ["Audit test"] }
        : candidate,
    )

    const serialized = JSON.stringify(
      createAuditEvents(localFixture, next, null),
    )

    expect(serialized).not.toContain(credential.awsSecretName)
    expect(serialized).not.toContain('"field":"awsSecretName"')
    expect(serialized).not.toContain('"field":"awsSecretKey"')
  })
})
