import { describe, expect, it } from "vitest"

import { createMockBackofficeApiClient } from "@/application/api/mock-api-client"
import { initialBackofficeState } from "@/mocks/system-fixture"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"

describe("mock backoffice API client", () => {
  it("handles request DTOs and exposes the changed data through a snapshot response", async () => {
    const client = createMockBackofficeApiClient({
      initialState: localFixture,
    })

    const result = await client.iam.createRole({
      body: {
        name: "감사 담당자 역할",
        description: "감사 업무 담당자를 연결합니다.",
      },
      requesterId: localDefaultUserId,
    })

    expect(result).toMatchObject({
      ok: true,
      value: { name: "감사 담당자 역할" },
    })
    const snapshot = await client.getSnapshot({})
    expect(
      snapshot.data.roles.some((role) => role.name === "감사 담당자 역할"),
    ).toBe(true)
  })

  it("rejects invalid request bodies without changing mock data", async () => {
    const client = createMockBackofficeApiClient({
      initialState: localFixture,
    })
    const before = await client.getSnapshot({})

    await expect(
      client.iam.createRole({
        body: { name: "x", description: "" },
        requesterId: localDefaultUserId,
      }),
    ).resolves.toEqual({ ok: false, error: "invalid-input" })
    await expect(client.getSnapshot({})).resolves.toEqual(before)
  })

  it("returns defensive snapshot copies", async () => {
    const client = createMockBackofficeApiClient({
      initialState: initialBackofficeState,
    })
    const first = await client.getSnapshot({})

    first.data.roles.splice(0)

    const second = await client.getSnapshot({})
    expect(second.data.roles).toHaveLength(initialBackofficeState.roles.length)
    expect(second.data.systemReferences).toEqual(
      initialBackofficeState.systemReferences,
    )
    expect(second.data.systemReferences).not.toBe(
      initialBackofficeState.systemReferences,
    )
  })

  it("rejects IAM, service, and request-template mutations without UI resource permission", async () => {
    const client = createMockBackofficeApiClient({ initialState: localFixture })
    const unauthorizedUser = localFixture.users.find(
      (user) => user.nickname === "Olivia",
    )
    const service = localFixture.services[0]
    const template = localFixture.approvalLines[0]
    if (!unauthorizedUser || !service || !template) {
      throw new Error("Authorization fixture is incomplete")
    }
    const before = await client.getSnapshot({})

    await expect(
      client.iam.createRole({
        body: {
          name: "권한 없는 역할",
          description: "인가 경계 회귀 검증용 역할입니다.",
        },
        requesterId: unauthorizedUser.id,
      }),
    ).resolves.toEqual({ ok: false, error: "policy-operation-forbidden" })
    await expect(
      client.serviceCatalog.updateService({
        id: service.id,
        body: {
          name: service.name,
          serviceKey: service.serviceKey,
          host: service.host,
          type: service.type,
          ownerOrganizationId: service.ownerOrganizationId,
          credentialTemplateIds: service.credentialTemplateIds,
        },
        requesterId: unauthorizedUser.id,
      }),
    ).resolves.toEqual({ ok: false, error: "policy-operation-forbidden" })
    await expect(
      client.requestTemplates.setApprovalLineStatus({
        approvalLineId: template.id,
        status: "inactive",
        requesterId: unauthorizedUser.id,
      }),
    ).resolves.toEqual({ ok: false, error: "policy-operation-forbidden" })
    await expect(client.getSnapshot({})).resolves.toEqual(before)
  })

  it("restricts service operators to services owned by organizations they lead", async () => {
    const client = createMockBackofficeApiClient({ initialState: localFixture })
    const serviceOperator = localFixture.users.find(
      (user) => user.nickname === "Emma",
    )
    const anotherOrganizationService = localFixture.services.find(
      (service) =>
        service.ownerOrganizationId !==
        localFixture.organizations.find(
          (organization) => organization.leaderUserId === serviceOperator?.id,
        )?.id,
    )
    if (!serviceOperator || !anotherOrganizationService) {
      throw new Error("Service ownership fixture is incomplete")
    }
    const before = await client.getSnapshot({})

    await expect(
      client.serviceCatalog.updateService({
        id: anotherOrganizationService.id,
        body: {
          name: anotherOrganizationService.name,
          serviceKey: anotherOrganizationService.serviceKey,
          host: anotherOrganizationService.host,
          type: anotherOrganizationService.type,
          ownerOrganizationId: anotherOrganizationService.ownerOrganizationId,
          credentialTemplateIds:
            anotherOrganizationService.credentialTemplateIds,
        },
        requesterId: serviceOperator.id,
      }),
    ).resolves.toEqual({ ok: false, error: "policy-operation-forbidden" })
    await expect(client.getSnapshot({})).resolves.toEqual(before)
  })

  it("allows a general user to create applications only for their organizations", async () => {
    const client = createMockBackofficeApiClient({ initialState: localFixture })
    const generalUser = localFixture.users.find(
      (user) => user.nickname === "Daniel",
    )
    const ownerOrganization = localFixture.organizations.find((organization) =>
      generalUser?.organizationIds.includes(organization.id),
    )
    const foreignOrganization = localFixture.organizations.find(
      (organization) => organization.id !== ownerOrganization?.id,
    )
    if (!generalUser || !ownerOrganization || !foreignOrganization) {
      throw new Error("Application organization scope fixture is incomplete")
    }

    const created = await client.iam.createApplication({
      body: {
        name: "Privacy Review Console",
        applicationKey: "privacy_review_console",
        description: "소속 조직이 사용하는 개인정보 검토 어플리케이션입니다.",
        ownerOrganizationId: ownerOrganization.id,
      },
      requesterId: generalUser.id,
    })
    expect(created).toMatchObject({
      ok: true,
      value: { ownerOrganizationId: ownerOrganization.id },
    })
    if (!created.ok) throw new Error(created.error)
    await expect(
      client.iam.updateApplication({
        applicationId: created.value.id,
        body: {
          ...created.value,
          name: "Privacy Review Workspace",
        },
        requesterId: generalUser.id,
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: { name: "Privacy Review Workspace" },
    })
    await expect(
      client.iam.createApplication({
        body: {
          name: "Foreign Organization Console",
          applicationKey: "foreign_organization_console",
          description: "다른 조직으로 등록할 수 없는 어플리케이션입니다.",
          ownerOrganizationId: foreignOrganization.id,
        },
        requesterId: generalUser.id,
      }),
    ).resolves.toEqual({
      ok: false,
      error: "policy-operation-forbidden",
    })
    await expect(
      client.iam.deleteApplication({
        applicationId: created.value.id,
        requesterId: generalUser.id,
      }),
    ).resolves.toMatchObject({ ok: true })
  })

  it("prevents deleting an application with a valid credential", async () => {
    const client = createMockBackofficeApiClient({ initialState: localFixture })
    const owner = localFixture.users.find((user) => user.nickname === "Emma")
    const application = localFixture.applications.find(
      (candidate) => candidate.name === "Developer Console",
    )
    if (!owner || !application) {
      throw new Error("Application credential fixture is incomplete")
    }

    await expect(
      client.iam.deleteApplication({
        applicationId: application.id,
        requesterId: owner.id,
      }),
    ).resolves.toEqual({ ok: false, error: "protected-relationship" })
  })

  it("marks only the current user's notification as read", async () => {
    const client = createMockBackofficeApiClient({ initialState: localFixture })
    const snapshot = await client.getSnapshot({})
    const notification = snapshot.data.notifications.find(
      (item) => !item.readAt,
    )
    if (!notification) throw new Error("Unread notification fixture is missing")

    await expect(
      client.home.markNotificationRead({
        notificationId: notification.id,
        requesterId: notification.userId,
      }),
    ).resolves.toMatchObject({ ok: true, value: { id: notification.id } })
    const updated = await client.getSnapshot({})
    expect(
      updated.data.notifications.find((item) => item.id === notification.id)
        ?.readAt,
    ).not.toBeNull()
  })

  it("supports role policy assignment and prevents namespace management policy revocation", async () => {
    const client = createMockBackofficeApiClient({ initialState: localFixture })
    const snapshot = await client.getSnapshot({})
    const administrator = snapshot.data.users.find(
      (user) => user.nickname === "David",
    )
    const policy = snapshot.data.accessPolicies.find(
      (candidate) => candidate.name === "운영 모니터링 허용",
    )
    if (!administrator || !policy)
      throw new Error("Policy fixture is incomplete")
    const created = await client.iam.createRole({
      body: { name: "감사 조회자", description: "감사 정책 검증 역할입니다." },
      requesterId: administrator.id,
    })
    if (!created.ok) throw new Error(created.error)

    await expect(
      client.accessPolicies.assignAccessPoliciesToTarget({
        accessPolicyIds: [policy.id],
        targetType: "role",
        targetId: created.value.id,
        requesterId: administrator.id,
      }),
    ).resolves.toMatchObject({ ok: true })

    const policyOperator = snapshot.data.users.find(
      (user) => user.nickname === "Owen",
    )
    const assignedSnapshot = await client.getSnapshot({})
    const assignedRelationship =
      assignedSnapshot.data.accessPolicyAssignments.find(
        (assignment) =>
          assignment.targetType === "role" &&
          assignment.targetId === created.value.id &&
          assignment.accessPolicyId === policy.id,
      )
    if (!policyOperator || !assignedRelationship) {
      throw new Error("Policy operator revocation fixture is incomplete")
    }
    await expect(
      client.accessPolicies.unassignAccessPolicyFromTarget({
        assignmentId: assignedRelationship.id,
        requesterId: policyOperator.id,
      }),
    ).resolves.toMatchObject({ ok: true })

    const namespace = snapshot.data.namespaces[0]
    if (!namespace) throw new Error("Namespace fixture is missing")
    const managerAssignment = snapshot.data.accessPolicyAssignments.find(
      (assignment) =>
        assignment.targetType === "role" &&
        assignment.targetId === namespace.managerRoleId &&
        assignment.accessPolicyId === namespace.managerAccessPolicyId,
    )
    if (!managerAssignment) {
      throw new Error("Namespace management assignment fixture is missing")
    }
    await expect(
      client.accessPolicies.unassignAccessPolicyFromTarget({
        assignmentId: managerAssignment.id,
        requesterId: administrator.id,
      }),
    ).resolves.toEqual({ ok: false, error: "protected-relationship" })
  })

  it("updates and deletes an unused custom role", async () => {
    const client = createMockBackofficeApiClient({ initialState: localFixture })
    const snapshot = await client.getSnapshot({})
    const administrator = snapshot.data.users.find(
      (user) => user.nickname === "David",
    )
    if (!administrator) throw new Error("Administrator fixture is missing")
    const created = await client.iam.createRole({
      body: { name: "임시 역할", description: "수정 삭제 검증용 역할입니다." },
      requesterId: administrator.id,
    })
    if (!created.ok) throw new Error(created.error)

    await expect(
      client.iam.updateRole({
        roleId: created.value.id,
        requesterId: administrator.id,
        body: { name: "변경 역할", description: "변경된 역할 설명입니다." },
      }),
    ).resolves.toMatchObject({ ok: true, value: { name: "변경 역할" } })
    await expect(
      client.iam.deleteRole({
        roleId: created.value.id,
        requesterId: administrator.id,
      }),
    ).resolves.toMatchObject({ ok: true })
  })
})
