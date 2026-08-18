import { describe, expect, it } from "vitest"

import {
  filterServiceKeyInput,
  serviceInputSchema,
  serviceTypeValues,
} from "@/features/service-catalog/model"

describe("service key input", () => {
  it("keeps only lowercase letters and hyphens", () => {
    expect(filterServiceKeyInput("한글API-developer_01-api")).toBe(
      "-developer-api",
    )
  })

  it("rejects invalid kebab-case structures after character filtering", () => {
    const input = {
      name: "Developer API",
      host: "https://api.example.com",
      type: serviceTypeValues.internal,
      ownerOrganizationId: "20000000-0000-4000-8000-000000000001",
      credentialTemplateIds: {
        issuance: "43000000-0000-4000-8000-000000000001",
        replacement: "43000000-0000-4000-8000-000000000002",
        disposal: "43000000-0000-4000-8000-000000000003",
      },
    }

    expect(
      serviceInputSchema.safeParse({ ...input, serviceKey: "developer-api" })
        .success,
    ).toBe(true)
    expect(
      serviceInputSchema.safeParse({ ...input, serviceKey: "-developer" })
        .success,
    ).toBe(false)
    expect(
      serviceInputSchema.safeParse({ ...input, serviceKey: "developer--api" })
        .success,
    ).toBe(false)
  })
})
