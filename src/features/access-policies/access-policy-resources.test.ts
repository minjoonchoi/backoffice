import { describe, expect, it } from "vitest"

import {
  accessPolicyResourceNames,
  resolveAccessPolicyResourceGroups,
  resolveAccessPolicyUiResources,
} from "@/features/access-policies/access-policy-resources"
import { uiResourceKeys } from "@/config/menu-registry"
import { localFixture } from "@/mocks/fixture"

describe("resolveAccessPolicyResourceGroups", () => {
  it("groups policy endpoints by their owning service", () => {
    const policy = localFixture.accessPolicies[0]
    if (!policy) throw new Error("Access policy fixture is missing")

    const groups = resolveAccessPolicyResourceGroups(localFixture, policy)

    expect(groups.map((group) => group.service.name)).toEqual([
      "Developer API",
      "Audit API",
    ])
    expect(
      groups.map((group) =>
        group.endpoints.map(({ endpoint }) => endpoint.name),
      ),
    ).toEqual([["상태 확인 API"], ["감사 이벤트 조회 API"]])
    expect(
      groups[1]?.endpoints[0]?.fields.map((field) => field.fieldPath),
    ).toEqual(["$.items"])
  })

  it("rejects an unresolved endpoint reference", () => {
    const policy = localFixture.accessPolicies[0]
    if (!policy) throw new Error("Access policy fixture is missing")

    expect(() =>
      resolveAccessPolicyResourceGroups(localFixture, {
        ...policy,
        resources: [
          {
            type: "endpoint",
            id: "00000000-0000-4000-8000-000000000000",
          },
        ],
      }),
    ).toThrow("Access policy endpoint not found")
  })

  it("includes normalized request and response fields in a policy resource", () => {
    const policy = localFixture.accessPolicies[1]
    if (!policy) throw new Error("Request field policy fixture is missing")

    const groups = resolveAccessPolicyResourceGroups(localFixture, policy)

    expect(groups[0]?.endpoints[0]?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          location: "header",
          fieldPath: "$['x-request-id']",
        }),
        expect.objectContaining({ location: "query", fieldPath: "$.dryRun" }),
        expect.objectContaining({
          location: "request-body",
          fieldPath: "$.eventType",
        }),
        expect.objectContaining({
          location: "request-body",
          fieldPath: "$.payload",
        }),
        expect.objectContaining({
          location: "response-body",
          fieldPath: "$.accepted",
        }),
      ]),
    )
  })

  it("resolves UI resource policies with their namespace context", () => {
    const resourcePolicy = localFixture.accessPolicies.find(
      (candidate) => candidate.name === "Backoffice UI 리소스 관리자 UI 접근",
    )
    if (!resourcePolicy)
      throw new Error("UI resource manager policy is missing")

    expect(
      resolveAccessPolicyResourceGroups(localFixture, resourcePolicy).map(
        (group) => group.service.name,
      ),
    ).toEqual(["Backoffice API"])
    expect(
      resolveAccessPolicyUiResources(localFixture, resourcePolicy).map(
        ({ resource }) => resource.key,
      ),
    ).toEqual([
      uiResourceKeys.uiResources.key,
      uiResourceKeys.uiResources.list.key,
      uiResourceKeys.uiResources.sync.key,
      uiResourceKeys.uiResources.list.actions.importUiResources,
      uiResourceKeys.uiResources.list.actions.changeUiResourceStatus,
      uiResourceKeys.uiResources.list.actions.deleteUiResources,
      uiResourceKeys.uiResources.list.actions.compareUiResourceSyncs,
      uiResourceKeys.uiResources.list.actions.restoreUiResourceSync,
    ])
    expect(accessPolicyResourceNames(localFixture, resourcePolicy)).toContain(
      "Backoffice / UI 리소스 동기화",
    )
  })
})
