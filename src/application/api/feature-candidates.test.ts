import { describe, expect, it } from "vitest"

import { createMockBackofficeApiClient } from "@/application/api/mock-api-client"
import { localFixture } from "@/mocks/fixture"

function requiredFixture<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`${label} fixture is missing`)
  return value
}

describe("candidate management API flows", () => {
  it("analyzes effective policy changes and notifies each recipient once", async () => {
    const client = createMockBackofficeApiClient({ initialState: localFixture })
    const administrator = requiredFixture(
      localFixture.users.find((user) => user.nickname === "David"),
      "Administrator",
    )
    const assignment = requiredFixture(
      localFixture.accessPolicyAssignments[0],
      "Policy assignment",
    )
    const policy = requiredFixture(
      localFixture.accessPolicies.find(
        (candidate) => candidate.id === assignment.accessPolicyId,
      ),
      "Assigned policy",
    )
    const body = {
      name: policy.name,
      description: `${policy.description} 영향 분석 검증`,
      type: policy.type,
      effect:
        policy.effect === "allow" ? ("deny" as const) : ("allow" as const),
      resources: policy.resources,
    }

    const analysis = await client.accessPolicies.analyzeAccessPolicyUpdate({
      accessPolicyId: policy.id,
      body,
      requesterId: administrator.id,
    })
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    expect(analysis.value.notificationRecipientUserIds.length).toBeGreaterThan(
      0,
    )
    expect(new Set(analysis.value.notificationRecipientUserIds).size).toBe(
      analysis.value.notificationRecipientUserIds.length,
    )

    const updated = await client.accessPolicies.updateAccessPolicy({
      accessPolicyId: policy.id,
      body,
      requesterId: administrator.id,
    })
    expect(updated.ok).toBe(true)
    const snapshot = (await client.getSnapshot({})).data
    const recipientIds = snapshot.notifications
      .filter(
        (notification) =>
          notification.event === "access-policy-updated" &&
          notification.targetId === policy.id,
      )
      .map((notification) => notification.userId)
      .toSorted()
    expect(recipientIds).toEqual(
      [...analysis.value.notificationRecipientUserIds].toSorted(),
    )
  })

  it("supports cloning, lifecycle operations, imports, revisions, and namespace history", async () => {
    const client = createMockBackofficeApiClient({ initialState: localFixture })
    const administrator = requiredFixture(
      localFixture.users.find((user) => user.nickname === "David"),
      "Administrator",
    )
    const sourcePolicy = requiredFixture(
      localFixture.accessPolicies.find(
        (policy) => !policy.name.startsWith("Access Governance 시스템 관리자"),
      ),
      "Source policy",
    )
    const clonedPolicy = await client.accessPolicies.createAccessPolicy({
      body: {
        name: "후보 기능 검증 접근",
        description: sourcePolicy.description,
        type: sourcePolicy.type,
        effect: sourcePolicy.effect,
        resources: sourcePolicy.resources,
      },
      requesterId: administrator.id,
    })
    expect(clonedPolicy.ok).toBe(true)
    if (!clonedPolicy.ok) return
    const updatedPolicy = await client.accessPolicies.updateAccessPolicy({
      accessPolicyId: clonedPolicy.value.id,
      body: {
        name: clonedPolicy.value.name,
        description: clonedPolicy.value.description,
        type: clonedPolicy.value.type,
        effect: clonedPolicy.value.effect,
        resources: clonedPolicy.value.resources,
      },
      requesterId: administrator.id,
    })
    expect(updatedPolicy.ok).toBe(true)

    const sourceTemplate = requiredFixture(
      localFixture.approvalLines[0],
      "Request template",
    )
    const clonedTemplate = await client.requestTemplates.cloneApprovalLine({
      sourceApprovalLineId: sourceTemplate.id,
      name: "후보 기능 검증 결재 템플릿",
      requesterId: administrator.id,
    })
    expect(clonedTemplate.ok && clonedTemplate.value.version).toBe(1)
    if (!clonedTemplate.ok) return
    const updatedTemplate = await client.requestTemplates.updateApprovalLine({
      id: clonedTemplate.value.id,
      body: {
        name: `${clonedTemplate.value.name} 수정`,
        category: clonedTemplate.value.category,
        type: clonedTemplate.value.type,
        approvalExecution: clonedTemplate.value.approvalExecution,
        steps: clonedTemplate.value.steps,
        fields: clonedTemplate.value.fields,
      },
      requesterId: administrator.id,
    })
    expect(updatedTemplate.ok && updatedTemplate.value.version).toBe(2)

    const service = requiredFixture(
      localFixture.services.find((candidate) => candidate.type === "internal"),
      "Internal service",
    )
    const syncBody = {
      serviceId: service.id,
      endpoints: [
        {
          name: "후보 기능 검증 API",
          method: "POST" as const,
          path: "/candidate-feature",
          version: "v1",
          lifecycle: "active" as const,
          fields: [
            {
              location: "request-body" as const,
              fieldPath: "$.name",
              valueType: "string" as const,
              required: true,
              description: "이름",
            },
          ],
        },
      ],
    }
    const syncAnalysis = await client.serviceCatalog.analyzeServiceEndpointSync(
      {
        body: syncBody,
        requesterId: administrator.id,
      },
    )
    expect(syncAnalysis.ok).toBe(true)
    if (!syncAnalysis.ok) return
    const addOperation = requiredFixture(
      syncAnalysis.value.operations.find(
        (operation) => operation.kind === "add",
      ),
      "Endpoint add operation",
    )
    const imported = await client.serviceCatalog.synchronizeServiceEndpoints({
      body: syncBody,
      selectedOperationKeys: [addOperation.key],
      requesterId: administrator.id,
    })
    expect(imported).toMatchObject({ ok: true, value: { addedCount: 1 } })
    if (!imported.ok) return
    const importedEndpoint = requiredFixture(
      (await client.getSnapshot({})).data.serviceEndpoints.find(
        (endpoint) =>
          endpoint.serviceId === service.id &&
          endpoint.path === "/candidate-feature",
      ),
      "Imported endpoint",
    )
    const endpointUpdated = await client.serviceCatalog.updateServiceEndpoint({
      id: importedEndpoint.id,
      body: {
        serviceId: service.id,
        name: importedEndpoint.name,
        method: importedEndpoint.method,
        path: importedEndpoint.path,
        version: "v2",
        lifecycle: "active",
        fields: [
          {
            location: "request-body",
            fieldPath: "$.displayName",
            valueType: "string",
            required: true,
            description: "표시 이름",
          },
        ],
      },
      requesterId: administrator.id,
    })
    expect(endpointUpdated.ok && endpointUpdated.value.version).toBe("v2")
    expect(
      (await client.getSnapshot({})).data.serviceEndpointRevisions.filter(
        (revision) => revision.endpointId === importedEndpoint.id,
      ),
    ).toHaveLength(1)
    expect(
      await client.serviceCatalog.setServiceEndpointLifecycle({
        id: importedEndpoint.id,
        lifecycle: "deprecated",
        requesterId: administrator.id,
      }),
    ).toMatchObject({ ok: true, value: { lifecycle: "deprecated" } })

    const credential = requiredFixture(localFixture.apiKeys[0], "Credential")
    const lifecycle =
      await client.credentials.updateCredentialLifecycleSettings({
        requesterId: administrator.id,
        body: {
          expirationPeriodDays: 180,
          rotationIntervalDays: 30,
        },
      })
    expect(lifecycle).toMatchObject({
      ok: true,
      value: { expirationPeriodDays: 180, rotationIntervalDays: 30 },
    })
    const revoked = await client.credentials.emergencyRevokeApiKey({
      body: {
        apiKeyId: credential.id,
        requesterId: administrator.id,
        reason: "노출 가능성이 확인되어 즉시 폐기합니다.",
      },
    })
    expect(revoked).toMatchObject({
      ok: true,
      value: { status: "inactive", nextRotationAt: null },
    })

    const initialHistory = requiredFixture(
      localFixture.uiResourceSyncHistories[0],
      "UI resource history",
    )
    expect(
      await client.uiResources.restoreUiResourceSync({
        historyId: initialHistory.id,
        requesterId: requiredFixture(
          localFixture.users.find((user) => user.nickname === "Owen"),
          "UI resource manager",
        ).id,
      }),
    ).toMatchObject({
      ok: true,
      value: { restoredFromHistoryId: initialHistory.id },
    })

    const namespace = await client.uiResources.createNamespace({
      body: {
        key: "candidate-system",
        name: "Candidate System",
        description: "후보 기능 검증을 위한 독립 네임스페이스입니다.",
        managerRoleId: managerRoleId(localFixture),
      },
      requesterId: administrator.id,
    })
    expect(namespace.ok).toBe(true)
    if (!namespace.ok) return
    expect(
      await client.uiResources.updateNamespaceManager({
        namespaceId: namespace.value.id,
        managerRoleId: localFixture.systemReferences.roleIds.policyOperator,
        requesterId: administrator.id,
      }),
    ).toMatchObject({
      ok: true,
      value: {
        managerRoleId: localFixture.systemReferences.roleIds.policyOperator,
      },
    })
    expect(
      await client.uiResources.retireNamespace({
        namespaceId: namespace.value.id,
        requesterId: administrator.id,
      }),
    ).toMatchObject({ ok: true, value: { status: "inactive" } })

    const snapshot = (await client.getSnapshot({})).data
    expect(snapshot.approvalLineRevisions).toHaveLength(1)
    expect(
      snapshot.notifications.some(
        (notification) => notification.event === "api-key-emergency-revoked",
      ),
    ).toBe(true)
  })
})

function managerRoleId(state: typeof localFixture) {
  return state.systemReferences.roleIds.administrator
}
