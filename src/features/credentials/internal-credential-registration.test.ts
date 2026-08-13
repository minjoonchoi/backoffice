import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import {
  HttpExternalCredentialRegistrar,
  HttpInternalCredentialRegistrar,
  type InternalCredentialRegistrationRequest,
} from "@/features/credentials/internal-credential-registration"
import { FetchApiTransport } from "@/lib/api-transport"
import { server } from "@/test/msw/server"

const baseUrl = "https://backoffice.example.test"
const input: InternalCredentialRegistrationRequest = {
  approvalDocumentId: "50000000-0000-4000-8000-000000000001",
  serviceId: "60000000-0000-4000-8000-000000000001",
  credentialName: "developer-api-key",
  awsSecretName: "backoffice/developer-api",
  awsSecretKey: "api-key",
}

describe("HttpInternalCredentialRegistrar", () => {
  it("posts the storage target and returns the validated API result", async () => {
    server.use(
      http.post(
        `${baseUrl}/api/internal-credential-registrations`,
        async ({ request }) => {
          await expect(request.json()).resolves.toEqual(input)
          return HttpResponse.json({ ...input, secret: "bok_internal_result" })
        },
      ),
    )

    const registrar = new HttpInternalCredentialRegistrar(
      new FetchApiTransport(baseUrl),
    )

    await expect(registrar.register(input)).resolves.toEqual({
      ...input,
      secret: "bok_internal_result",
    })
  })

  it("sends a manually entered EXTERNAL key without returning the secret", async () => {
    server.use(
      http.post(
        `${baseUrl}/api/external-credential-registrations`,
        async ({ request }) => {
          await expect(request.json()).resolves.toEqual({
            ...input,
            secret: "external-secret-value",
          })
          return HttpResponse.json(input)
        },
      ),
    )

    const registrar = new HttpExternalCredentialRegistrar(
      new FetchApiTransport(baseUrl),
    )

    await expect(
      registrar.register({ ...input, secret: "external-secret-value" }),
    ).resolves.toEqual(input)
  })
})
