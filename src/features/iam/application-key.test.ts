import { describe, expect, it } from "vitest"

import {
  applicationInputSchema,
  filterApplicationKeyInput,
} from "@/features/iam/model"

describe("application key input", () => {
  it("keeps only lowercase letters, numbers, and underscores", () => {
    expect(filterApplicationKeyInput("한글ABC-console_01-테스트")).toBe(
      "console_01",
    )
  })

  it("rejects invalid snake_case structures after character filtering", () => {
    const input = {
      name: "Developer Console",
      description: "Development application",
      ownerOrganizationId: "20000000-0000-4000-8000-000000000001",
    }

    expect(
      applicationInputSchema.safeParse({
        ...input,
        applicationKey: "console_01",
      }).success,
    ).toBe(true)
    expect(
      applicationInputSchema.safeParse({ ...input, applicationKey: "_console" })
        .success,
    ).toBe(false)
    expect(
      applicationInputSchema.safeParse({
        ...input,
        applicationKey: "console__01",
      }).success,
    ).toBe(false)
  })
})
