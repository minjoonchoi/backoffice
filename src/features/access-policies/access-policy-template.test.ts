import { describe, expect, it } from "vitest"

import {
  accessPolicyApprovalLines,
  resolveAccessPolicyApprovalLine,
} from "@/features/access-policies/access-policy-template"
import { localFixture } from "@/mocks/fixture"

describe("access policy request template", () => {
  it("resolves the single active template from the policy type", () => {
    const line = resolveAccessPolicyApprovalLine(localFixture, "access-grant")

    expect(line.name).toBe("권한 부여 요청 템플릿")
  })

  it("rejects ambiguous active templates for the same policy type", () => {
    const line = resolveAccessPolicyApprovalLine(localFixture, "access-grant")
    const state = {
      approvalLines: [
        ...localFixture.approvalLines,
        { ...line, id: "00000000-0000-4000-8000-000000000099" },
      ],
    }

    expect(accessPolicyApprovalLines(state, "access-grant")).toHaveLength(2)
    expect(() =>
      resolveAccessPolicyApprovalLine(state, "access-grant"),
    ).toThrow("exactly one active request template")
  })
})
