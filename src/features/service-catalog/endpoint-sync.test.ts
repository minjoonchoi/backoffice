import { describe, expect, it } from "vitest"

import { createMockBackofficeApiClient } from "@/application/api/mock-api-client"
import { createEndpointSyncPlan } from "@/features/service-catalog/endpoint-sync"
import type { ServiceEndpointValue } from "@/features/service-catalog/model"
import { localFixture } from "@/mocks/fixture"

function endpointValue(endpointId: string): ServiceEndpointValue {
  const endpoint = localFixture.serviceEndpoints.find(
    (candidate) => candidate.id === endpointId,
  )
  if (!endpoint) throw new Error("Endpoint fixture is missing")
  return {
    serviceId: endpoint.serviceId,
    name: endpoint.name,
    method: endpoint.method,
    path: endpoint.path,
    version: endpoint.version,
    lifecycle: endpoint.lifecycle,
    fields: localFixture.serviceEndpointFields
      .filter((field) => field.endpointId === endpoint.id)
      .map((field) => ({
        location: field.location,
        fieldPath: field.fieldPath,
        valueType: field.valueType,
        required: field.required,
        description: field.description,
      })),
  }
}

describe("OpenAPI endpoint synchronization", () => {
  it("classifies additions, updates, deletions, and unchanged endpoints", () => {
    const service = localFixture.services.find(
      (candidate) =>
        candidate.type === "internal" &&
        localFixture.serviceEndpoints.filter(
          (endpoint) => endpoint.serviceId === candidate.id,
        ).length >= 2,
    )
    if (!service) throw new Error("Internal service fixture is missing")
    const current = localFixture.serviceEndpoints.filter(
      (endpoint) => endpoint.serviceId === service.id,
    )
    const retained = endpointValue(current[0]?.id ?? "")
    const updated = endpointValue(current[1]?.id ?? "")
    const removableEndpoint = {
      id: "71000000-0000-4000-8000-000000000001",
      serviceId: service.id,
      name: "Manifest에서 제거된 엔드포인트",
      method: "DELETE" as const,
      path: "/removed-from-manifest",
      version: "v1",
      lifecycle: "active" as const,
      createdAt: "2026-08-15T00:00:00.000Z",
    }
    const state = {
      ...localFixture,
      serviceEndpoints: [...localFixture.serviceEndpoints, removableEndpoint],
    }
    const plan = createEndpointSyncPlan(state, service.id, [
      retained,
      { ...updated, name: `${updated.name} 수정` },
      {
        serviceId: service.id,
        name: "동기화 신규 엔드포인트",
        method: "POST",
        path: "/synchronized-endpoint",
        version: "v1",
        lifecycle: "active",
        fields: [],
      },
    ])

    expect(plan.operations.map((operation) => operation.kind)).toEqual(
      expect.arrayContaining(["add", "update", "delete", "unchanged"]),
    )
    expect(
      plan.operations.find(
        (operation) => operation.current?.id === removableEndpoint.id,
      ),
    ).toMatchObject({ kind: "delete", blockedReason: null })
  })

  it("applies selected operations, records the actor, and notifies affected users once", async () => {
    const actor = localFixture.users.find((user) => user.nickname === "David")
    const service = localFixture.services.find(
      (candidate) =>
        candidate.type === "internal" &&
        localFixture.serviceEndpoints.some(
          (endpoint) => endpoint.serviceId === candidate.id,
        ),
    )
    if (!actor || !service)
      throw new Error("Synchronization fixture is missing")
    const current = localFixture.serviceEndpoints.filter(
      (endpoint) => endpoint.serviceId === service.id,
    )
    const endpoints = current.map((endpoint, index) => ({
      ...endpointValue(endpoint.id),
      name: index === 0 ? `${endpoint.name} 동기화` : endpoint.name,
    }))
    endpoints.push({
      serviceId: service.id,
      name: "감사 검증 엔드포인트",
      method: "POST",
      path: "/audit-sync",
      version: "v1",
      lifecycle: "active",
      fields: [],
    })
    const body = {
      serviceId: service.id,
      endpoints: endpoints.map((endpoint) => ({
        name: endpoint.name,
        method: endpoint.method,
        path: endpoint.path,
        version: endpoint.version,
        lifecycle: endpoint.lifecycle,
        fields: endpoint.fields,
      })),
    }
    const client = createMockBackofficeApiClient({
      initialState: localFixture,
      getActorUserId: () => actor.id,
    })
    const analysis = await client.serviceCatalog.analyzeServiceEndpointSync({
      body,
      requesterId: actor.id,
    })
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    const selected = analysis.value.operations.filter(
      (operation) => operation.kind === "add" || operation.kind === "update",
    )
    const result = await client.serviceCatalog.synchronizeServiceEndpoints({
      body,
      selectedOperationKeys: selected.map((operation) => operation.key),
      requesterId: actor.id,
    })
    expect(result).toMatchObject({
      ok: true,
      value: { addedCount: 1, updatedCount: 1 },
    })
    await Promise.resolve()
    const snapshot = (await client.getSnapshot({})).data
    const notifications = snapshot.notifications.filter(
      (notification) =>
        notification.event === "service-endpoints-synchronized" &&
        notification.targetId === service.id,
    )
    expect(
      new Set(notifications.map((notification) => notification.userId)).size,
    ).toBe(notifications.length)
    expect(notifications.length).toBeGreaterThan(0)
    expect(
      snapshot.auditEvents.some(
        (event) =>
          event.resourceType === "endpoint" && event.actorUserId === actor.id,
      ),
    ).toBe(true)
  })
})
