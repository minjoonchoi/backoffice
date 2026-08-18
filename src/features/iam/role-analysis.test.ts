import { describe, expect, it } from "vitest"

import { compareRoles, isUnusedRole } from "@/features/iam/role-analysis"
import type { AccessPolicy } from "@/features/access-policies/model"
import type { Role } from "@/features/iam/model"

function role(id: string, userIds: string[] = []): Role {
  return {
    id,
    name: id,
    description: `${id} description`,
    userIds,
    organizationIds: [],
    createdAt: "2026-08-01T00:00:00.000Z",
  }
}

function policy(id: string, resourceId: string): AccessPolicy {
  return {
    id,
    name: id,
    description: `${id} description`,
    type: "access-grant",
    managementType: "general",
    effect: "allow",
    resources: [{ type: "endpoint", id: resourceId }],
    status: "active",
    createdAt: "2026-08-01T00:00:00.000Z",
  }
}

describe("role analysis", () => {
  it("detects roles with no direct users or organizations", () => {
    expect(isUnusedRole(role("unused"))).toBe(true)
    expect(isUnusedRole(role("used", ["user-1"]))).toBe(false)
  })

  it("compares direct policies and their resource coverage", () => {
    const state = {
      accessPolicies: [
        policy("left", "left-resource"),
        policy("shared", "shared-resource"),
        policy("right", "right-resource"),
      ],
      accessPolicyAssignments: [
        {
          id: "a1",
          accessPolicyId: "left",
          targetType: "role" as const,
          targetId: "role-left",
          expiresAt: null,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "a2",
          accessPolicyId: "shared",
          targetType: "role" as const,
          targetId: "role-left",
          expiresAt: null,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "a3",
          accessPolicyId: "shared",
          targetType: "role" as const,
          targetId: "role-right",
          expiresAt: null,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "a4",
          accessPolicyId: "right",
          targetType: "role" as const,
          targetId: "role-right",
          expiresAt: null,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    }

    expect(compareRoles(state, "role-left", "role-right")).toEqual({
      onlyLeftPolicyIds: ["left"],
      sharedPolicyIds: ["shared"],
      onlyRightPolicyIds: ["right"],
      onlyLeftResourceKeys: ["endpoint:left-resource"],
      sharedResourceKeys: ["endpoint:shared-resource"],
      onlyRightResourceKeys: ["endpoint:right-resource"],
    })
  })
})
