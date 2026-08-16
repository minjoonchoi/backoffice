import { describe, expect, it } from "vitest"

import { parseOpenApiEndpoints } from "@/features/service-catalog/openapi-import"

const serviceId = "60000000-0000-4000-8000-000000000001"

describe("parseOpenApiEndpoints", () => {
  it("normalizes parameters and request/response schemas from YAML", () => {
    const preview = parseOpenApiEndpoints(
      `openapi: 3.0.3
info:
  title: Orders API
  version: v2
paths:
  /orders/{orderId}:
    parameters:
      - in: path
        name: orderId
        required: true
        schema: { type: string }
    post:
      summary: 주문 변경
      parameters:
        - in: header
          name: x-request-id
          schema: { type: string }
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [status]
              properties:
                status: { type: string }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  accepted: { type: boolean }
`,
      serviceId,
    )

    expect(preview.title).toBe("Orders API")
    expect(preview.endpoints).toHaveLength(1)
    expect(preview.endpoints[0]).toMatchObject({
      serviceId,
      name: "주문 변경",
      method: "POST",
      path: "/orders/{orderId}",
      version: "v2",
    })
    expect(preview.endpoints[0]?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ location: "path", fieldPath: "$.orderId" }),
        expect.objectContaining({
          location: "header",
          fieldPath: "$['x-request-id']",
        }),
        expect.objectContaining({
          location: "request-body",
          fieldPath: "$.status",
          required: true,
        }),
        expect.objectContaining({
          location: "response-body",
          fieldPath: "$.accepted",
        }),
      ]),
    )
  })

  it("rejects malformed or endpoint-free documents", () => {
    expect(() => parseOpenApiEndpoints("openapi: [", serviceId)).toThrow()
    expect(() =>
      parseOpenApiEndpoints(
        JSON.stringify({
          openapi: "3.0.3",
          info: { title: "Empty" },
          paths: {},
        }),
        serviceId,
      ),
    ).toThrow("openapi-endpoints-empty")
  })
})
