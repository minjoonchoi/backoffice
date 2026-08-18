import { describe, expect, it } from "vitest"

import { POST } from "@/app/api/external-credential-registrations/route"

const url = "http://localhost/api/external-credential-registrations"
const validInput = {
  approvalDocumentId: "50000000-0000-4000-8000-000000000001",
  serviceId: "60000000-0000-4000-8000-000000000002",
  credentialName: "collaboration-key",
  awsSecretName: "access-governance/collaboration-saas",
  awsSecretKey: "api-key",
  secret: "external-secret-value",
}

describe("POST /api/external-credential-registrations", () => {
  it("accepts a manually entered key without echoing it", async () => {
    const response = await POST(
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validInput),
      }),
    )

    expect(response.status).toBe(201)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({
      approvalDocumentId: validInput.approvalDocumentId,
      serviceId: validInput.serviceId,
      credentialName: validInput.credentialName,
      awsSecretName: validInput.awsSecretName,
      awsSecretKey: validInput.awsSecretKey,
    })
  })

  it("rejects a missing manual key", async () => {
    const response = await POST(
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validInput, secret: undefined }),
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "invalid-input" })
  })
})
