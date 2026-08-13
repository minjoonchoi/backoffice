import { NextResponse } from "next/server"

import { externalCredentialRegistrationRequestSchema } from "@/features/credentials/internal-credential-registration"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "invalid-json" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  const parsed = externalCredentialRegistrationRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-input" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  const storedCredential = {
    approvalDocumentId: parsed.data.approvalDocumentId,
    serviceId: parsed.data.serviceId,
    credentialName: parsed.data.credentialName,
    awsSecretName: parsed.data.awsSecretName,
    awsSecretKey: parsed.data.awsSecretKey,
  }
  return NextResponse.json(storedCredential, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  })
}
