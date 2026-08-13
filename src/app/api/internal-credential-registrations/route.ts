import { NextResponse } from "next/server"

import { internalCredentialRegistrationRequestSchema } from "@/features/credentials/internal-credential-registration"

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

  const parsed = internalCredentialRegistrationRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-input" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  return NextResponse.json(
    {
      ...parsed.data,
      secret: `bok_${crypto.randomUUID().replaceAll("-", "")}`,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  )
}
