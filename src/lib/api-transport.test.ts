import { delay, http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  FetchApiTransport,
  InvalidJsonError,
  InvalidResponseError,
} from "@/lib/api-transport"
import { server } from "@/test/msw/server"

const baseUrl = "https://api.example.test"
const schema = z.object({ id: z.string(), active: z.boolean() })

describe("FetchApiTransport", () => {
  it("returns a validated response for a successful request", async () => {
    server.use(
      http.get(`${baseUrl}/viewer`, () =>
        HttpResponse.json({ id: "viewer-1", active: true }),
      ),
    )

    const transport = new FetchApiTransport(baseUrl)
    await expect(
      transport.request({ path: "/viewer" }, schema),
    ).resolves.toEqual({ id: "viewer-1", active: true })
  })

  it("throws a typed error for a non-successful HTTP response", async () => {
    server.use(
      http.get(`${baseUrl}/viewer`, () =>
        HttpResponse.json({ message: "unavailable" }, { status: 503 }),
      ),
    )

    const transport = new FetchApiTransport(baseUrl)
    await expect(
      transport.request({ path: "/viewer" }, schema),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "HttpResponseError",
        status: 503,
      }),
    )
  })

  it("rejects a body that is not valid JSON", async () => {
    server.use(
      http.get(
        `${baseUrl}/viewer`,
        () => new HttpResponse("not-json", { status: 200 }),
      ),
    )

    const transport = new FetchApiTransport(baseUrl)
    await expect(
      transport.request({ path: "/viewer" }, schema),
    ).rejects.toBeInstanceOf(InvalidJsonError)
  })

  it("rejects a JSON body that does not match the response schema", async () => {
    server.use(
      http.get(`${baseUrl}/viewer`, () =>
        HttpResponse.json({ id: 42, active: "yes" }),
      ),
    )

    const transport = new FetchApiTransport(baseUrl)
    await expect(
      transport.request({ path: "/viewer" }, schema),
    ).rejects.toBeInstanceOf(InvalidResponseError)
  })

  it("preserves the native abort error", async () => {
    server.use(
      http.get(`${baseUrl}/viewer`, async () => {
        await delay("infinite")
        return HttpResponse.json({ id: "viewer-1", active: true })
      }),
    )
    const controller = new AbortController()
    const transport = new FetchApiTransport(baseUrl)
    const request = transport.request(
      { path: "/viewer", init: { signal: controller.signal } },
      schema,
    )

    controller.abort()

    await expect(request).rejects.toMatchObject({ name: "AbortError" })
  })
})
