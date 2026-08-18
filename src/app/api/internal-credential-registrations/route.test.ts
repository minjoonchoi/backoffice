import { describe, expect, it } from "vitest"

import { POST } from "@/app/api/internal-credential-registrations/route"
import { internalCredentialRegistrationResponseSchema } from "@/features/credentials/internal-credential-registration"

const url = "http://localhost/api/internal-credential-registrations"
const validInput = {
  approvalDocumentId: "50000000-0000-4000-8000-000000000001",
  serviceId: "60000000-0000-4000-8000-000000000001",
  credentialName: "developer-api-key",
  awsSecretName: "access-governance/developer-api",
  awsSecretKey: "api-key",
}

describe("POST /api/internal-credential-registrations", () => {
  it("returns the internally registered credential result", async () => {
    const response = await POST(
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validInput),
      }),
    )

    expect(response.status).toBe(201)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    const responseBody: unknown = await response.json()
    const registration =
      internalCredentialRegistrationResponseSchema.parse(responseBody)
    expect(registration).toMatchObject(validInput)
    expect(registration.secret).toMatch(/^bok_[a-f0-9]{32}$/)
  })

  it("rejects malformed JSON and invalid storage targets", async () => {
    const malformed = await POST(
      new Request(url, { method: "POST", body: "{" }),
    )
    expect(malformed.status).toBe(400)
    await expect(malformed.json()).resolves.toEqual({ error: "invalid-json" })

    const invalid = await POST(
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validInput, awsSecretName: "invalid name" }),
      }),
    )
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toEqual({ error: "invalid-input" })
  })
})
