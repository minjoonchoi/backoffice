import { describe, expect, it } from "vitest"

import { resolveEndpointChangeImpact } from "@/features/service-catalog/endpoint-impact"
import { localFixture } from "@/mocks/fixture"

describe("resolveEndpointChangeImpact", () => {
  it("reports field and referencing policy or credential changes", () => {
    const endpoint = localFixture.serviceEndpoints.find((candidate) =>
      localFixture.accessPolicies.some((policy) =>
        policy.resources.some(
          (resource) =>
            resource.type === "endpoint" && resource.id === candidate.id,
        ),
      ),
    )
    if (!endpoint) throw new Error("Referenced endpoint fixture is missing")
    const currentFields = localFixture.serviceEndpointFields.filter(
      (field) => field.endpointId === endpoint.id,
    )
    const retained = currentFields[0]
    if (!retained) throw new Error("Endpoint field fixture is missing")

    const impact = resolveEndpointChangeImpact(localFixture, endpoint.id, [
      { ...retained, description: `${retained.description} changed` },
      {
        location: "query",
        fieldPath: "$.newField",
        valueType: "string",
        required: false,
        description: "new field",
      },
    ])

    expect(impact.addedFields).toHaveLength(1)
    expect(impact.changedFields).toHaveLength(1)
    expect(impact.removedFields).toHaveLength(
      Math.max(currentFields.length - 1, 0),
    )
    expect(impact.accessPolicyIds.length).toBeGreaterThan(0)
  })
})
