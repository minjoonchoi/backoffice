import { NextResponse } from "next/server"

export function isBackofficeAccessAllowed(
  environment = process.env.NODE_ENV,
  override = process.env.ALLOW_UNAUTHENTICATED_BACKOFFICE,
) {
  return environment !== "production" || override === "true"
}

export function proxy() {
  if (!isBackofficeAccessAllowed()) {
    return new NextResponse("Backoffice authentication is not configured.", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api/healthz|_next/static|_next/image|favicon.ico).*)"],
}
