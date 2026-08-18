import { z } from "zod"

import {
  awsSecretKeySchema,
  awsSecretNameSchema,
  apiKeySecretSchema,
} from "@/features/credentials/model"
import { FetchApiTransport, type ApiTransport } from "@/lib/api-transport"

export const internalCredentialRegistrationRequestSchema = z.object({
  approvalDocumentId: z.uuid(),
  serviceId: z.uuid(),
  credentialName: z.string().trim().min(2).max(80),
  awsSecretName: awsSecretNameSchema,
  awsSecretKey: awsSecretKeySchema,
})

export const internalCredentialRegistrationResponseSchema =
  internalCredentialRegistrationRequestSchema.extend({
    secret: apiKeySecretSchema,
  })

export const externalCredentialRegistrationRequestSchema =
  internalCredentialRegistrationRequestSchema.extend({
    secret: apiKeySecretSchema,
  })

export const externalCredentialRegistrationResponseSchema =
  internalCredentialRegistrationRequestSchema

export type InternalCredentialRegistrationRequest = z.infer<
  typeof internalCredentialRegistrationRequestSchema
>
export type InternalCredentialRegistrationResponse = z.infer<
  typeof internalCredentialRegistrationResponseSchema
>
export type ExternalCredentialRegistrationRequest = z.infer<
  typeof externalCredentialRegistrationRequestSchema
>

export interface InternalCredentialRegistrar {
  register(
    input: InternalCredentialRegistrationRequest,
  ): Promise<InternalCredentialRegistrationResponse>
}

export interface ExternalCredentialRegistrar {
  register(
    input: ExternalCredentialRegistrationRequest,
  ): Promise<InternalCredentialRegistrationRequest>
}

export class HttpInternalCredentialRegistrar implements InternalCredentialRegistrar {
  constructor(
    private readonly transport: ApiTransport = new FetchApiTransport(),
  ) {}

  register(input: InternalCredentialRegistrationRequest) {
    return this.transport.request(
      {
        path: "/api/internal-credential-registrations",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      },
      internalCredentialRegistrationResponseSchema,
    )
  }
}

export class HttpExternalCredentialRegistrar implements ExternalCredentialRegistrar {
  constructor(
    private readonly transport: ApiTransport = new FetchApiTransport(),
  ) {}

  register(input: ExternalCredentialRegistrationRequest) {
    return this.transport.request(
      {
        path: "/api/external-credential-registrations",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      },
      externalCredentialRegistrationResponseSchema,
    )
  }
}
