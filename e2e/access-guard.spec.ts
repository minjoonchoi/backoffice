import { expect, test } from "@playwright/test"

const allowBaseUrl = `http://localhost:${process.env.PLAYWRIGHT_ALLOW_PORT ?? "3000"}`
const blockedBaseUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_BLOCKED_PORT ?? "3001"}`

test("allows only the explicit production override and keeps health public", async ({
  request,
}) => {
  const allowed = await request.get(`${allowBaseUrl}/`)
  expect(allowed.status()).toBe(200)

  const blocked = await request.get(`${blockedBaseUrl}/`)
  expect(blocked.status()).toBe(503)
  expect(await blocked.text()).toBe(
    "Backoffice authentication is not configured.",
  )
  expect(blocked.headers()["x-robots-tag"]).toBe("noindex, nofollow")

  const health = await request.get(`${blockedBaseUrl}/api/healthz`)
  expect(health.status()).toBe(200)
  await expect(health.json()).resolves.toEqual({ status: "ok" })
})
