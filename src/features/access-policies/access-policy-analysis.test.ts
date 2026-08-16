import { describe, expect, it } from "vitest"

import {
  resolveAccessPolicyConflicts,
  simulateAccessPolicyGrant,
} from "@/features/access-policies/access-policy-analysis"
import type {
  AccessPolicy,
  AccessPolicyResource,
} from "@/features/access-policies/model"
import { localFixture } from "@/mocks/fixture"

const resource: AccessPolicyResource = { type: "endpoint", id: "endpoint-1" }

function policy(id: string, effect: "allow" | "deny"): AccessPolicy {
  return {
    id,
    name: `${effect} policy`,
    description: `${effect} policy description`,
    type: "access-grant",
    managementType: "operator-managed",
    effect,
    resources: [resource],
    status: "active",
    createdAt: "2026-08-01T00:00:00.000Z",
  }
}

describe("access policy analysis", () => {
  it("finds allow-deny conflicts and ignores inactive policies", () => {
    const allow = policy("allow", "allow")
    const deny = policy("deny", "deny")
    const inactiveDeny = {
      ...policy("inactive-deny", "deny"),
      status: "inactive" as const,
    }

    expect(resolveAccessPolicyConflicts([allow, deny, inactiveDeny])).toEqual([
      {
        resource,
        allowPolicyIds: ["allow"],
        denyPolicyIds: ["deny"],
      },
    ])
  })

  it("separates new, existing, and denied resources in a grant simulation", () => {
    const user = localFixture.users[0]
    if (!user) throw new Error("User fixture is missing")
    const existingResource = { type: "endpoint", id: "existing" } as const
    const deniedResource = { type: "endpoint", id: "denied" } as const
    const state = {
      users: [user],
      roles: [],
      accessPolicies: [
        {
          ...policy("existing-policy", "allow"),
          resources: [existingResource],
        },
        { ...policy("denied-policy", "deny"), resources: [deniedResource] },
      ],
      accessPolicyAssignments: [
        {
          id: "assignment-1",
          accessPolicyId: "existing-policy",
          targetType: "user" as const,
          targetId: user.id,
          expiresAt: null,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "assignment-2",
          accessPolicyId: "denied-policy",
          targetType: "user" as const,
          targetId: user.id,
          expiresAt: null,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    }
    const simulation = simulateAccessPolicyGrant(state, user.id, {
      ...policy("candidate", "allow"),
      resources: [resource, existingResource, deniedResource],
    })

    expect(simulation).toEqual({
      granted: [resource],
      alreadyGranted: [existingResource],
      denied: [deniedResource],
    })
  })
})
