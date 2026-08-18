import { describe, expect, it } from "vitest"

import {
  parseEndpointFieldSection,
  parseEndpointFields,
} from "@/features/service-catalog/editor-support"
import { endpointFieldLocationValues } from "@/features/service-catalog/model"

describe("endpoint editor support", () => {
  it("rejects malformed JSON and values that are not arrays", () => {
    expect(parseEndpointFieldSection("{")).toBeNull()
    expect(parseEndpointFieldSection('{"fieldPath":"$.id"}')).toBeNull()
  })

  it("normalizes body field locations before schema validation", () => {
    const body = JSON.stringify([
      {
        fieldPath: "$.payload.id",
        valueType: "string",
        required: true,
        description: "identifier",
      },
    ])

    expect(
      parseEndpointFieldSection(body, endpointFieldLocationValues.requestBody),
    ).toEqual([
      {
        fieldPath: "$.payload.id",
        valueType: "string",
        required: true,
        description: "identifier",
        location: endpointFieldLocationValues.requestBody,
      },
    ])
    expect(parseEndpointFields("[]", body, "[]")).toHaveLength(1)
  })
})
