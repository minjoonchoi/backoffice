import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"

import { resolveUiResourceAssignmentTargets } from "@/auth/ui-resource-policy-access"
import {
  menuDefinitions,
  uiResourceKeys,
  uiResourceManifest,
} from "@/config/menu-registry"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import type {
  ExternalCredentialRegistrar,
  InternalCredentialRegistrar,
} from "@/features/credentials/internal-credential-registration"
import type { UiResourceManifest } from "@/features/ui-resources/ui-resource-manifest"
import {
  defaultBackofficeAdminRole,
  defaultGeneralUserRole,
  defaultIamOperatorRole,
  defaultPolicyOperatorRole,
  defaultServiceOperatorRole,
  defaultNamespace,
  initialBackofficeState,
} from "@/mocks/system-fixture"
import { uiResourceManagerUiResourceKeys } from "@/config/system-ui-access"
import type { BackofficeState } from "@/application/state/model"
import type { BackofficeApiClientFactory } from "@/application/api/api-client"
import { createMockBackofficeApiClient } from "@/application/api/mock-api-client"
import { BackofficeProvider, useBackoffice } from "@/application/state/provider"
import { AuditActorProvider } from "@/features/audit/audit-actor-provider"
import type { ApprovalLine } from "@/features/request-templates/model"
import {
  createRequestApprovalLineDraft,
  toRequestApprovalStepInputs,
} from "@/features/request-templates/request-approval-line"

const testInternalCredentialRegistrar: InternalCredentialRegistrar = {
  register(input) {
    return Promise.resolve({
      ...input,
      secret: "bok_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    })
  },
}

const testExternalCredentialRegistrar: ExternalCredentialRegistrar = {
  register(input) {
    return Promise.resolve({
      approvalDocumentId: input.approvalDocumentId,
      serviceId: input.serviceId,
      credentialName: input.credentialName,
      awsSecretName: input.awsSecretName,
      awsSecretKey: input.awsSecretKey,
    })
  },
}

function createTestApiClientFactory(
  internalCredentialRegistrar: InternalCredentialRegistrar = testInternalCredentialRegistrar,
  externalCredentialRegistrar: ExternalCredentialRegistrar = testExternalCredentialRegistrar,
): BackofficeApiClientFactory {
  return ({ initialState }) =>
    createMockBackofficeApiClient({
      initialState,
      internalCredentialRegistrar,
      externalCredentialRegistrar,
    })
}

const testApiClientFactory = createTestApiClientFactory()

function approvalStepsFromTemplate(
  state: Pick<BackofficeState, "organizations" | "users">,
  template: ApprovalLine,
  requesterId: string,
  requestOrganizationId: string,
  options?: {
    serviceOwnerOrganizationId?: string
    userAssignments?: Readonly<Record<string, string>>
  },
) {
  const draft = createRequestApprovalLineDraft(state, template, {
    requesterId,
    requestOrganizationId,
    serviceOwnerOrganizationId: options?.serviceOwnerOrganizationId,
  }).map((step) => ({
    ...step,
    assigneeId: options?.userAssignments?.[step.id] ?? step.assigneeId,
  }))
  return toRequestApprovalStepInputs(draft)
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <BackofficeProvider
      initialState={initialBackofficeState}
      apiClientFactory={testApiClientFactory}
    >
      {children}
    </BackofficeProvider>
  )
}

function FixtureWrapper({ children }: { children: ReactNode }) {
  return (
    <AuditActorProvider initialActorUserId={localDefaultUserId}>
      <BackofficeProvider
        initialState={localFixture}
        apiClientFactory={testApiClientFactory}
      >
        {children}
      </BackofficeProvider>
    </AuditActorProvider>
  )
}

async function completeApprovalDocument(
  backoffice: ReturnType<typeof useBackoffice>,
  documentId: string,
) {
  let document = backoffice.approvalDocuments.find(
    (candidate) => candidate.id === documentId,
  )
  if (!document) throw new Error(`Approval document not found: ${documentId}`)
  while (document.status === "submitted") {
    const step = document.approvalSteps.find(
      (candidate) => candidate.status === "pending",
    )
    if (!step) throw new Error(`Pending approval step not found: ${documentId}`)
    const actorUserId =
      step.assigneeType === "user"
        ? step.assigneeId
        : backoffice.users.find(
            (user) =>
              user.employmentStatus === "employed" &&
              user.organizationIds.includes(step.assigneeId),
          )?.id
    if (!actorUserId) {
      throw new Error(`Approval step assignee not found: ${step.id}`)
    }
    const result = await backoffice.processApprovalDocument({
      documentId,
      actorUserId,
      stepId: step.id,
      decision: step.kind === "reference" ? "acknowledge" : "approve",
      comment: "테스트 처리",
    })
    if (!result.ok) return result
    document = result.value.document
  }
  return { ok: true, value: { document } }
}

const seededOrganizationId = "91000000-0000-4000-8000-000000000001"
const seededUserId = "91000000-0000-4000-8000-000000000002"
const seededBackofficeState = {
  ...initialBackofficeState,
  roles: initialBackofficeState.roles.map((role) =>
    role.id === initialBackofficeState.systemReferences.roleIds.administrator
      ? { ...role, userIds: [seededUserId] }
      : role,
  ),
  organizations: [
    {
      id: seededOrganizationId,
      name: "기본 조직",
      leaderUserId: seededUserId,
      createdAt: "2026-08-08T00:00:00.000Z",
    },
  ],
  users: [
    {
      id: seededUserId,
      nickname: "seed-leader",
      email: "seed-leader@example.com",
      employmentStatus: "employed",
      organizationIds: [seededOrganizationId],
      createdAt: "2026-08-08T00:00:00.000Z",
    },
  ],
} satisfies BackofficeState

function SeededWrapper({ children }: { children: ReactNode }) {
  return (
    <AuditActorProvider initialActorUserId={seededUserId}>
      <BackofficeProvider
        initialState={seededBackofficeState}
        apiClientFactory={testApiClientFactory}
      >
        {children}
      </BackofficeProvider>
    </AuditActorProvider>
  )
}

function fixtureEndpointFields(endpointId: string) {
  return localFixture.serviceEndpointFields
    .filter((field) => field.endpointId === endpointId)
    .map((field) => ({
      location: field.location,
      fieldPath: field.fieldPath,
      valueType: field.valueType,
      required: field.required,
      description: field.description,
    }))
}

describe("BackofficeProvider", () => {
  it("maps UI commands to an injected API client request and refreshes its snapshot", async () => {
    let receivedRequest: { body: unknown } | null = null
    const apiClientFactory: BackofficeApiClientFactory = ({ initialState }) => {
      const client = createMockBackofficeApiClient({ initialState })
      return {
        ...client,
        iam: {
          ...client.iam,
          createRole: (request) => {
            receivedRequest = request
            return client.iam.createRole(request)
          },
        },
      }
    }
    function ApiClientWrapper({ children }: { children: ReactNode }) {
      return (
        <AuditActorProvider initialActorUserId={seededUserId}>
          <BackofficeProvider
            initialState={seededBackofficeState}
            apiClientFactory={apiClientFactory}
          >
            {children}
          </BackofficeProvider>
        </AuditActorProvider>
      )
    }
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: ApiClientWrapper,
    })
    const input = {
      name: "감사 담당자",
      description: "감사 업무 담당자를 연결합니다.",
    }

    const response = await act(() => result.current.createRole(input))

    expect(response.ok).toBe(true)
    expect(receivedRequest).toEqual({ body: input, requesterId: seededUserId })
    expect(result.current.roles.some((role) => role.name === input.name)).toBe(
      true,
    )
  })

  it("starts with system roles", () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: Wrapper,
    })
    const adminRole = result.current.roles.find(
      (role) => role.name === "Backoffice 시스템 관리자",
    )

    expect(adminRole).toBeDefined()
    if (!adminRole) return
    expect(result.current.roles.map((role) => role.name)).toEqual([
      "Backoffice 시스템 관리자",
      "Backoffice 정책 운영자",
      "Backoffice IAM 운영자",
      "Backoffice 일반 사용자",
      "Backoffice UI 리소스 관리자",
      "Backoffice 서비스 운영자",
    ])
    expect(result.current.uiResources).toHaveLength(
      uiResourceManifest.resources.length,
    )
    expect(
      menuDefinitions.every((menu) =>
        resolveUiResourceAssignmentTargets(
          result.current,
          menu.id,
        ).roleIds.includes(adminRole.id),
      ),
    ).toBe(true)
    expect(
      menuDefinitions
        .filter((menu) =>
          resolveUiResourceAssignmentTargets(
            result.current,
            menu.id,
          ).roleIds.includes(defaultGeneralUserRole.id),
        )
        .map((menu) => menu.id),
    ).toEqual([
      "home",
      "approvalDocuments",
      "services",
      "serviceEndpoints",
      "apiKeys",
    ])
    expect(
      menuDefinitions
        .filter((menu) =>
          resolveUiResourceAssignmentTargets(
            result.current,
            menu.id,
          ).roleIds.includes(defaultIamOperatorRole.id),
        )
        .map((menu) => menu.id),
    ).toEqual(["users", "organizations", "roles", "applications"])
    expect(
      uiResourceManifest.resources
        .filter(
          (resource) =>
            resource.type === "action" &&
            ["users", "organizations", "roles", "applications"].some((menuId) =>
              resource.key.startsWith(`${menuId}:`),
            ) &&
            resource.key !==
              uiResourceKeys.users.detail.actions.changeEmploymentStatus,
        )
        .every((resource) =>
          resolveUiResourceAssignmentTargets(
            result.current,
            resource.key,
          ).roleIds.includes(defaultIamOperatorRole.id),
        ),
    ).toBe(true)
    expect(
      uiResourceManifest.resources
        .filter((resource) => resource.type === "action")
        .every((resource) =>
          resolveUiResourceAssignmentTargets(
            result.current,
            resource.key,
          ).roleIds.includes(adminRole.id),
        ),
    ).toBe(true)
    expect(
      uiResourceManifest.resources
        .filter((resource) =>
          resolveUiResourceAssignmentTargets(
            result.current,
            resource.key,
          ).roleIds.includes(defaultPolicyOperatorRole.id),
        )
        .map((resource) => resource.key),
    ).toEqual([
      uiResourceKeys.approvalDocuments.key,
      uiResourceKeys.approvalDocuments.list.key,
      uiResourceKeys.approvalDocuments.requestDetail.key,
      uiResourceKeys.approvalDocuments.detail.key,
      uiResourceKeys.approvalDocuments.create.key,
      uiResourceKeys.approvalDocuments.update.key,
      uiResourceKeys.approvalDocuments.request.key,
      uiResourceKeys.approvalDocuments.list.actions.createPolicy,
      uiResourceKeys.approvalDocuments.list.actions.simulatePolicyAccess,
      uiResourceKeys.approvalDocuments.detail.actions.updatePolicy,
      uiResourceKeys.approvalDocuments.detail.actions.deletePolicy,
      uiResourceKeys.approvalDocuments.detail.actions.clonePolicy,
    ])
  })

  it("updates a request template while preserving its identity", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: FixtureWrapper,
    })
    const template = result.current.approvalLines[0]
    expect(template).toBeDefined()
    if (!template) return

    const updated = await act(() =>
      result.current.updateApprovalLine(template.id, {
        ...template,
        name: "수정된 자격증명 발급 템플릿",
        steps: template.steps,
        fields: template.fields.map((field, index) =>
          index === 0 ? { ...field, label: "대상 시스템" } : field,
        ),
      }),
    )

    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    expect(updated.value).toMatchObject({
      id: template.id,
      name: "수정된 자격증명 발급 템플릿",
      status: template.status,
      createdAt: template.createdAt,
    })
    expect(updated.value.steps[0]?.id).toBe(template.steps[0]?.id)
    expect(updated.value.fields[0]).toMatchObject({
      id: template.fields[0]?.id,
      label: "대상 시스템",
    })
    expect(
      await act(() =>
        result.current.updateApprovalLine(
          "00000000-0000-4000-8000-999999999999",
          {
            ...template,
            steps: template.steps,
            fields: template.fields,
          },
        ),
      ),
    ).toEqual({ ok: false, error: "approval-line-not-found" })
  })

  it("creates an access policy with validated template and endpoints", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: FixtureWrapper,
    })
    const approvalLine = result.current.approvalLines.find(
      (line) =>
        line.status === "active" &&
        line.category === "permission" &&
        line.type === "access-grant",
    )
    const endpoint = result.current.serviceEndpoints[0]
    const operator = result.current.users.find(
      (user) => user.nickname === "Owen",
    )
    expect(approvalLine).toBeDefined()
    expect(endpoint).toBeDefined()
    expect(operator).toBeDefined()
    if (!approvalLine || !endpoint || !operator) return

    const created = await act(() =>
      result.current.createAccessPolicy(
        {
          name: "서비스 상태 조회 허용",
          description: "서비스 상태 확인에 필요한 엔드포인트를 허용합니다.",
          type: "access-grant",
          effect: "allow",
          resources: [{ type: "endpoint", id: endpoint.id }],
        },
        operator.id,
      ),
    )

    expect(created).toMatchObject({
      ok: true,
      value: {
        name: "서비스 상태 조회 허용",
        status: "active",
        type: "access-grant",
        resources: [{ type: "endpoint", id: endpoint.id }],
      },
    })
    expect(result.current.accessPolicies.at(-1)?.name).toBe(
      "서비스 상태 조회 허용",
    )
    const uiResource = result.current.uiResources[0]
    if (!uiResource) {
      throw new Error("UI policy resource fixtures are missing")
    }
    expect(
      await act(() =>
        result.current.createAccessPolicy(
          {
            name: "Backoffice UI 리소스 허용",
            description: "같은 유형의 UI 리소스 접근을 허용합니다.",
            type: "access-grant",
            effect: "allow",
            resources: [{ type: "ui-resource", id: uiResource.id }],
          },
          operator.id,
        ),
      ),
    ).toMatchObject({
      ok: true,
      value: {
        resources: [{ type: "ui-resource", id: uiResource.id }],
      },
    })
    expect(
      await act(() =>
        result.current.createAccessPolicy(
          {
            name: "서비스 상태 조회 허용",
            description: "중복 정책입니다.",
            type: "access-grant",
            effect: "deny",
            resources: [{ type: "endpoint", id: endpoint.id }],
          },
          operator.id,
        ),
      ),
    ).toEqual({ ok: false, error: "policy-name-exists" })
    expect(
      await act(() =>
        result.current.createAccessPolicy(
          {
            name: "존재하지 않는 엔드포인트 정책",
            description: "존재하지 않는 엔드포인트는 참조할 수 없습니다.",
            type: "access-grant",
            effect: "allow",
            resources: [
              {
                type: "endpoint",
                id: "00000000-0000-4000-8000-999999999999",
              },
            ],
          },
          operator.id,
        ),
      ),
    ).toEqual({ ok: false, error: "endpoint-not-found" })
  })

  it("keeps endpoints global while limiting UI resources to one namespace", async () => {
    const state = structuredClone(localFixture)
    const backofficeResource = state.uiResources[0]
    const endpoint = state.serviceEndpoints[0]
    const operator = state.users.find((user) => user.nickname === "Owen")
    if (!backofficeResource || !endpoint || !operator) {
      throw new Error("Policy namespace fixtures are missing")
    }
    const namespaceId = "99000000-0000-4000-8000-000000000030"
    state.namespaces.push({
      id: namespaceId,
      key: "customer-console",
      name: "Customer Console",
      description: "UI resource policy namespace validation fixture.",
      managerRoleId: state.systemReferences.roleIds.administrator,
      managerAccessPolicyId: "99000000-0000-4000-8000-000000000031",
      status: "active",
      lastSyncedAt: null,
      createdAt: "2026-08-12T00:00:00.000Z",
    })
    const customerResource = {
      ...backofficeResource,
      id: "99000000-0000-4000-8000-000000000032",
      namespaceId,
      key: "customers",
      parentKey: null,
      name: "고객",
      description: "Customer Console 고객 메뉴입니다.",
    }
    state.uiResources.push(customerResource)
    function PolicyNamespaceWrapper({ children }: { children: ReactNode }) {
      return (
        <BackofficeProvider
          initialState={state}
          apiClientFactory={testApiClientFactory}
        >
          {children}
        </BackofficeProvider>
      )
    }
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: PolicyNamespaceWrapper,
    })

    expect(
      await act(() =>
        result.current.createAccessPolicy(
          {
            name: "Backoffice 화면과 전역 API 접근",
            description:
              "Backoffice UI 리소스와 전역 카탈로그 엔드포인트를 함께 허용합니다.",
            type: "access-grant",
            effect: "allow",
            resources: [
              { type: "ui-resource", id: backofficeResource.id },
              { type: "endpoint", id: endpoint.id },
            ],
          },
          operator.id,
        ),
      ),
    ).toMatchObject({ ok: true })
    expect(
      await act(() =>
        result.current.createAccessPolicy(
          {
            name: "교차 네임스페이스 UI 접근",
            description:
              "서로 다른 네임스페이스의 UI 리소스는 함께 저장할 수 없습니다.",
            type: "access-grant",
            effect: "allow",
            resources: [
              { type: "ui-resource", id: backofficeResource.id },
              { type: "ui-resource", id: customerResource.id },
            ],
          },
          operator.id,
        ),
      ),
    ).toEqual({ ok: false, error: "ui-resource-namespace-mismatch" })
  })

  it("applies unassigned policy changes immediately", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: FixtureWrapper,
    })
    const policy = result.current.accessPolicies.find(
      (item) =>
        !result.current.accessPolicyAssignments.some(
          (assignment) => assignment.accessPolicyId === item.id,
        ),
    )
    const operator = result.current.users.find(
      (user) => user.nickname === "Owen",
    )
    expect(policy).toBeDefined()
    expect(operator).toBeDefined()
    if (!policy || !operator) return

    const updated = await act(() =>
      result.current.updateAccessPolicy(
        policy.id,
        { ...policy, name: "직접 수정된 정책" },
        operator.id,
      ),
    )
    expect(updated).toMatchObject({
      ok: true,
      value: { name: "직접 수정된 정책" },
    })

    const deleted = await act(() =>
      result.current.deleteAccessPolicy(policy.id, operator.id),
    )
    expect(deleted).toMatchObject({
      ok: true,
      value: { status: "inactive" },
    })
  })

  it("applies assigned policy changes immediately for an authorized operator", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: FixtureWrapper,
    })
    const assignment = result.current.accessPolicyAssignments[0]
    const operator = result.current.users.find(
      (user) => user.nickname === "Owen",
    )
    expect(assignment).toBeDefined()
    expect(operator).toBeDefined()
    if (!assignment || !operator) return
    const policy = result.current.accessPolicies.find(
      (item) => item.id === assignment.accessPolicyId,
    )
    expect(policy).toBeDefined()
    if (!policy) return

    const updated = await act(() =>
      result.current.updateAccessPolicy(
        policy.id,
        { ...policy, name: "즉시 수정될 정책" },
        operator.id,
      ),
    )
    expect(updated).toMatchObject({
      ok: true,
      value: { name: "즉시 수정될 정책" },
    })
    expect(
      result.current.accessPolicies.find((item) => item.id === policy.id)?.name,
    ).toBe("즉시 수정될 정책")
    expect(
      result.current.notifications.some(
        (notification) =>
          notification.event === "access-policy-updated" &&
          notification.targetType === "access-policy" &&
          notification.targetId === policy.id,
      ),
    ).toBe(true)

    const deleted = await act(() =>
      result.current.deleteAccessPolicy(policy.id, operator.id),
    )
    expect(deleted).toMatchObject({
      ok: true,
      value: { status: "inactive" },
    })
  })

  it("changes an individual UI resource status", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: FixtureWrapper,
    })
    const manager = result.current.users.find(
      (user) => user.nickname === "Owen",
    )
    const generalUser = result.current.users.find(
      (user) => user.nickname === "Emma",
    )
    const resource = result.current.uiResources.find(
      (candidate) => candidate.key === uiResourceKeys.approvalLines.key,
    )
    if (!manager || !generalUser || !resource) {
      throw new Error("UI resource status fixtures are missing")
    }

    const updated = await act(() =>
      result.current.setUiResourceStatus(resource.id, "inactive", manager.id),
    )
    expect(updated.ok && updated.value.status).toBe("inactive")
    expect(
      result.current.uiResources.find((item) => item.id === resource.id)
        ?.status,
    ).toBe("inactive")
    expect(
      await act(() =>
        result.current.setUiResourceStatus(
          resource.id,
          "active",
          generalUser.id,
        ),
      ),
    ).toEqual({ ok: false, error: "ui-resource-status-forbidden" })
  })

  it("resolves dynamic approval steps for employed organization members", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: SeededWrapper,
    })
    const requester = await act(() =>
      result.current.createUser({
        nickname: "minjoon",
        email: "minjoon@example.com",
        employmentStatus: "employed",
        organizationIds: [seededOrganizationId],
      }),
    )
    expect(requester.ok).toBe(true)
    if (!requester.ok) return

    const organization = await act(() =>
      result.current.createOrganization({
        name: "플랫폼 운영",
        leaderUserId: requester.value.id,
      }),
    )
    expect(organization.ok).toBe(true)
    if (!organization.ok) return
    const approver = await act(() =>
      result.current.createUser({
        nickname: "approver",
        email: "approver@example.com",
        employmentStatus: "employed",
        organizationIds: [organization.value.id],
      }),
    )
    expect(approver.ok).toBe(true)
    if (!approver.ok) return

    const line = await act(() =>
      result.current.createApprovalLine({
        name: "동적 요청 템플릿",
        category: "permission",
        type: "resource-create",
        steps: [
          { kind: "request", assigneeMode: "requester", stage: 1 },
          {
            kind: "approval",
            assigneeMode: "document-select",
            stage: 2,
          },
        ],
        fields: [],
      }),
    )
    expect(line.ok).toBe(true)
    if (!line.ok) return
    const approvalStep = line.value.steps[1]
    if (!approvalStep) throw new Error("Approval step is missing")

    const document = await act(() =>
      result.current.createApprovalDocument({
        documentKind: "general",
        title: "권한 변경 요청",
        type: "resource-create",
        organizationId: organization.value.id,
        requesterId: requester.value.id,
        approvalLineId: line.value.id,
        content: "운영 권한 변경을 요청합니다.",
        fieldValues: [],
        approvalSteps: approvalStepsFromTemplate(
          result.current,
          line.value,
          requester.value.id,
          organization.value.id,
          { userAssignments: { [approvalStep.id]: approver.value.id } },
        ),
        submission: "submitted",
      }),
    )
    expect(document.ok).toBe(true)
    if (!document.ok) return
    expect(document.value.approvalSteps.map((step) => step.assigneeId)).toEqual(
      [requester.value.id, approver.value.id],
    )
    expect(result.current.notifications.at(-1)).toMatchObject({
      userId: requester.value.id,
      event: "request-submitted",
      targetType: "approval-document",
      targetId: document.value.id,
    })
  })

  it("rejects duplicate nicknames", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: SeededWrapper,
    })
    await act(() =>
      result.current.createUser({
        nickname: "operator",
        email: "one@example.com",
        employmentStatus: "employed",
        organizationIds: [seededOrganizationId],
      }),
    )
    const duplicate = await act(() =>
      result.current.createUser({
        nickname: "operator",
        email: "two@example.com",
        employmentStatus: "employed",
        organizationIds: [seededOrganizationId],
      }),
    )
    expect(duplicate).toEqual({ ok: false, error: "user-nickname-exists" })
  })

  it("does not activate a user without an organization", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: FixtureWrapper,
    })
    const resigned = await act(() =>
      result.current.createUser({
        nickname: "resigned-user",
        email: "resigned-user@example.com",
        employmentStatus: "resigned",
        organizationIds: [],
      }),
    )
    expect(resigned.ok).toBe(true)
    if (!resigned.ok) return

    expect(
      await act(() =>
        result.current.setUserEmploymentStatus(
          resigned.value.id,
          "employed",
          localFixture.users.find((user) => user.nickname === "David")?.id ??
            "",
        ),
      ),
    ).toEqual({ ok: false, error: "invalid-input" })
    expect(
      result.current.users.find((user) => user.id === resigned.value.id)
        ?.employmentStatus,
    ).toBe("resigned")
  })

  it("creates roles with empty assignments and rejects duplicate names", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: SeededWrapper,
    })
    const role = await act(() =>
      result.current.createRole({
        name: "서비스 관리자",
        description: "서비스 설정과 엔드포인트를 관리합니다.",
      }),
    )
    expect(role.ok).toBe(true)
    if (!role.ok) return
    expect(role.value.userIds).toEqual([])
    expect(role.value.organizationIds).toEqual([])

    const duplicate = await act(() =>
      result.current.createRole({
        name: "서비스 관리자",
        description: "중복 역할입니다.",
      }),
    )
    expect(duplicate).toEqual({ ok: false, error: "role-name-exists" })
  })

  it("adds organization and role assignments from either detail direction", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: SeededWrapper,
    })
    const leader = await act(() =>
      result.current.createUser({
        nickname: "assignment-leader",
        email: "assignment-leader@example.com",
        employmentStatus: "employed",
        organizationIds: [seededOrganizationId],
      }),
    )
    const member = await act(() =>
      result.current.createUser({
        nickname: "assignment-member",
        email: "assignment-member@example.com",
        employmentStatus: "employed",
        organizationIds: [seededOrganizationId],
      }),
    )
    expect(leader.ok && member.ok).toBe(true)
    if (!leader.ok || !member.ok) return

    const organization = await act(() =>
      result.current.createOrganization({
        name: "권한 운영 조직",
        leaderUserId: leader.value.id,
      }),
    )
    const firstRole = await act(() =>
      result.current.createRole({
        name: "권한 관리자",
        description: "권한을 관리합니다.",
      }),
    )
    const secondRole = await act(() =>
      result.current.createRole({
        name: "권한 조회자",
        description: "권한을 조회합니다.",
      }),
    )
    expect(organization.ok && firstRole.ok && secondRole.ok).toBe(true)
    if (!organization.ok || !firstRole.ok || !secondRole.ok) return

    const membership = await act(() =>
      result.current.addOrganizationsToUser(member.value.id, [
        organization.value.id,
      ]),
    )
    expect(membership.ok && membership.value.organizationIds).toEqual([
      seededOrganizationId,
      organization.value.id,
    ])

    const userAssignments = await act(() =>
      result.current.assignUsersToRoles(
        [member.value.id],
        [firstRole.value.id, secondRole.value.id],
      ),
    )
    expect(userAssignments.ok).toBe(true)
    const duplicateAssignment = await act(() =>
      result.current.assignUsersToRoles(
        [member.value.id],
        [firstRole.value.id],
      ),
    )
    expect(
      duplicateAssignment.ok && duplicateAssignment.value[0]?.userIds,
    ).toEqual([member.value.id])

    const organizationAssignments = await act(() =>
      result.current.assignOrganizationsToRoles(
        [organization.value.id],
        [firstRole.value.id],
      ),
    )
    expect(
      organizationAssignments.ok &&
        organizationAssignments.value[0]?.organizationIds,
    ).toEqual([organization.value.id])

    const missingRole = await act(() =>
      result.current.assignUsersToRoles(
        [member.value.id],
        [crypto.randomUUID()],
      ),
    )
    expect(missingRole).toEqual({ ok: false, error: "role-not-found" })
  })

  it("supports organization hierarchy, edits, and multiple user memberships", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: SeededWrapper,
    })
    const leader = await act(() =>
      result.current.createUser({
        nickname: "leader",
        email: "leader@example.com",
        employmentStatus: "employed",
        organizationIds: [seededOrganizationId],
      }),
    )
    const member = await act(() =>
      result.current.createUser({
        nickname: "member",
        email: "member@example.com",
        employmentStatus: "employed",
        organizationIds: [seededOrganizationId],
      }),
    )
    expect(leader.ok && member.ok).toBe(true)
    if (!leader.ok || !member.ok) return

    const parent = await act(() =>
      result.current.createOrganization({
        name: "기술 본부",
        leaderUserId: leader.value.id,
      }),
    )
    expect(parent.ok).toBe(true)
    if (!parent.ok) return
    const child = await act(() =>
      result.current.createOrganization({
        name: "플랫폼 팀",
        leaderUserId: leader.value.id,
        parentId: parent.value.id,
      }),
    )
    expect(child.ok).toBe(true)
    if (!child.ok) return

    const added = await act(() =>
      result.current.addUsersToOrganization(parent.value.id, [member.value.id]),
    )
    expect(added.ok).toBe(true)
    const secondMembership = await act(() =>
      result.current.addUsersToOrganization(child.value.id, [member.value.id]),
    )
    expect(secondMembership.ok).toBe(true)
    expect(
      result.current.users.find((user) => user.id === member.value.id)
        ?.organizationIds,
    ).toEqual([seededOrganizationId, parent.value.id, child.value.id])

    const updated = await act(() =>
      result.current.updateOrganization(child.value.id, {
        name: "플랫폼 운영",
        leaderUserId: member.value.id,
        parentId: parent.value.id,
      }),
    )
    expect(updated.ok && updated.value.name).toBe("플랫폼 운영")
    const cycle = await act(() =>
      result.current.updateOrganization(parent.value.id, {
        name: "기술 본부",
        leaderUserId: leader.value.id,
        parentId: child.value.id,
      }),
    )
    expect(cycle).toEqual({ ok: false, error: "invalid-input" })
  })

  it("validates an application slug and keeps it immutable", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: SeededWrapper,
    })
    expect(
      await act(() =>
        result.current.createApplication(
          {
            name: "Invalid Slug Application",
            slug: "invalid-slug",
            description: "snake_case가 아닌 slug 입력을 거부합니다.",
            ownerOrganizationId: seededOrganizationId,
          },
          seededUserId,
        ),
      ),
    ).toEqual({ ok: false, error: "invalid-input" })

    const application = await act(() =>
      result.current.createApplication(
        {
          name: "Automation Worker",
          slug: "automation_worker",
          description: "권한 주체로 사용하는 자동화 어플리케이션입니다.",
          ownerOrganizationId: seededOrganizationId,
        },
        seededUserId,
      ),
    )
    expect(application.ok).toBe(true)
    if (!application.ok) return
    expect(
      await act(() =>
        result.current.updateApplication(
          application.value.id,
          { ...application.value, slug: "renamed_worker" },
          seededUserId,
        ),
      ),
    ).toEqual({ ok: false, error: "protected-relationship" })
    expect(
      await act(() =>
        result.current.deleteApplication(application.value.id, seededUserId),
      ),
    ).toMatchObject({ ok: true })
  })

  it("registers a system-generated API key only after its request is approved", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: SeededWrapper,
    })
    const requester = await act(() =>
      result.current.createUser({
        nickname: "api-owner",
        email: "api@example.com",
        employmentStatus: "employed",
        organizationIds: [seededOrganizationId],
      }),
    )
    if (!requester.ok) return
    const organization = await act(() =>
      result.current.createOrganization({
        name: "API 운영",
        leaderUserId: requester.value.id,
      }),
    )
    if (!organization.ok) return
    const application = await act(() =>
      result.current.createApplication(
        {
          name: "Partner Console",
          slug: "partner_console",
          description:
            "파트너 API 자격증명을 소유하는 테스트 어플리케이션입니다.",
          ownerOrganizationId: organization.value.id,
        },
        seededUserId,
      ),
    )
    if (!application.ok) return
    const line = await act(() =>
      result.current.createApprovalLine({
        name: "API Key 발급 요청 템플릿",
        category: "credential",
        type: "api-key",
        steps: [
          {
            kind: "request",
            assigneeMode: "requester",
            stage: 1,
          },
          {
            kind: "approval",
            assigneeMode: "request-organization-leader",
            stage: 2,
          },
          {
            kind: "agreement",
            assigneeMode: "service-owner-organization",
            stage: 3,
          },
          {
            kind: "reference",
            assigneeMode: "request-organization",
            stage: 4,
          },
        ],
        fields: [
          {
            key: "service",
            label: "서비스",
            binding: "service-id",
            control: "service-select",
            required: true,
          },
          {
            key: "request-organization",
            label: "요청 조직",
            binding: "request-organization-id",
            control: "organization-select",
            required: true,
          },
          {
            key: "key-name",
            label: "키 이름",
            binding: "key-name",
            control: "text",
            required: true,
          },
          {
            key: "aws-secret-name",
            label: "AWS ASM Secret name",
            binding: "aws-secret-name",
            control: "text",
            required: true,
          },
          {
            key: "aws-secret-key",
            label: "Secret value key",
            binding: "aws-secret-key",
            control: "text",
            required: true,
          },
          {
            key: "reason",
            label: "요청 사유",
            binding: "content",
            control: "textarea",
            required: true,
          },
        ],
      }),
    )
    if (!line.ok) return
    const replacementLine = await act(() =>
      result.current.createApprovalLine({
        name: "API Key 교체 요청 템플릿",
        category: "credential",
        type: "api-key-replace",
        steps: [
          { kind: "request", assigneeMode: "requester", stage: 1 },
          {
            kind: "approval",
            assigneeMode: "request-organization-leader",
            stage: 2,
          },
          {
            kind: "agreement",
            assigneeMode: "service-owner-organization",
            stage: 3,
          },
        ],
        fields: [
          {
            key: "request-organization",
            label: "요청 조직",
            binding: "request-organization-id",
            control: "organization-select",
            required: true,
          },
          {
            key: "aws-secret-name",
            label: "AWS ASM Secret name",
            binding: "aws-secret-name",
            control: "text",
            required: true,
          },
          {
            key: "aws-secret-key",
            label: "Secret value key",
            binding: "aws-secret-key",
            control: "text",
            required: true,
          },
          {
            key: "reason",
            label: "교체 사유",
            binding: "content",
            control: "textarea",
            required: true,
          },
        ],
      }),
    )
    if (!replacementLine.ok) return
    const disposalLine = await act(() =>
      result.current.createApprovalLine({
        name: "API Key 폐기 요청 템플릿",
        category: "credential",
        type: "api-key-dispose",
        steps: [
          { kind: "request", assigneeMode: "requester", stage: 1 },
          {
            kind: "approval",
            assigneeMode: "request-organization-leader",
            stage: 2,
          },
          {
            kind: "agreement",
            assigneeMode: "service-owner-organization",
            stage: 3,
          },
        ],
        fields: [
          {
            key: "request-organization",
            label: "요청 조직",
            binding: "request-organization-id",
            control: "organization-select",
            required: true,
          },
          {
            key: "reason",
            label: "폐기 사유",
            binding: "content",
            control: "textarea",
            required: true,
          },
        ],
      }),
    )
    if (!disposalLine.ok) return
    const service = await act(() =>
      result.current.createService({
        name: "파트너 API",
        slug: "partner-api",
        host: "https://partner.example.com",
        type: "internal",
        ownerOrganizationId: organization.value.id,
        credentialTemplateIds: {
          issuance: line.value.id,
          replacement: replacementLine.value.id,
          disposal: disposalLine.value.id,
        },
      }),
    )
    if (!service.ok) return
    const firstEndpoint = await act(() =>
      result.current.createServiceEndpoint({
        serviceId: service.value.id,
        name: "파트너 조회 API",
        method: "GET",
        path: "/v1/partners",
        fields: [],
      }),
    )
    const secondEndpoint = await act(() =>
      result.current.createServiceEndpoint({
        serviceId: service.value.id,
        name: "파트너 등록 API",
        method: "POST",
        path: "/v1/partners",
        fields: [],
      }),
    )
    if (!firstEndpoint.ok || !secondEndpoint.ok) return
    const credentialEndpointIds = [
      firstEndpoint.value.id,
      secondEndpoint.value.id,
    ]
    const issuanceInput = {
      documentKind: "api-key-issuance" as const,
      title: "파트너 연동 키 발급",
      type: "api-key" as const,
      organizationId: organization.value.id,
      requesterId: requester.value.id,
      approvalLineId: line.value.id,
      content: "파트너 시스템 연동을 위한 발급 요청입니다.",
      fieldValues: [],
      approvalSteps: approvalStepsFromTemplate(
        result.current,
        line.value,
        requester.value.id,
        organization.value.id,
        { serviceOwnerOrganizationId: service.value.ownerOrganizationId },
      ),
      submission: "submitted" as const,
      applicationId: application.value.id,
      serviceId: service.value.id,
      endpointIds: credentialEndpointIds,
      keyName: "partner-integration",
      awsSecretName: "backoffice/partner-api",
      awsSecretKey: "partner-integration",
    }
    expect(
      await act(() =>
        result.current.createApprovalDocument({
          ...issuanceInput,
          endpointIds: [],
        }),
      ),
    ).toEqual({ ok: false, error: "api-key-request-invalid" })
    const document = await act(() =>
      result.current.createApprovalDocument(issuanceInput),
    )
    expect(result.current.apiKeys).toHaveLength(0)
    if (!document.ok) return
    expect(document.value).toMatchObject({
      documentKind: "api-key-issuance",
      endpointIds: credentialEndpointIds,
    })
    const completion = await act(() =>
      completeApprovalDocument(result.current, document.value.id),
    )
    expect(completion.ok).toBe(true)
    if (!completion.ok) return
    expect(result.current.apiKeys).toHaveLength(0)
    expect(
      completion.value.document.approvalSteps.map((step) => ({
        stage: step.stage,
        type: step.assigneeType,
        id: step.assigneeId,
      })),
    ).toEqual([
      { stage: 1, type: "user", id: requester.value.id },
      { stage: 2, type: "user", id: requester.value.id },
      { stage: 3, type: "organization", id: organization.value.id },
      { stage: 4, type: "organization", id: organization.value.id },
    ])
    const registration = await act(() =>
      result.current.registerApiKey({
        approvalDocumentId: document.value.id,
        registeredByUserId: requester.value.id,
      }),
    )
    expect(registration.ok).toBe(true)
    if (!registration.ok) return
    expect(registration.value.secret).toMatch(/^bok_[a-f0-9]{32}$/)
    expect(registration.value.apiKey).not.toHaveProperty("maskedValue")
    expect(registration.value.apiKey).not.toHaveProperty("registrationMethod")
    expect(registration.value.apiKey.registeredByUserId).toBe(
      requester.value.id,
    )
    expect(registration.value.apiKey).toMatchObject({
      awsSecretName: "backoffice/partner-api",
      awsSecretKey: "partner-integration",
      endpointIds: credentialEndpointIds,
      applicationId: application.value.id,
    })
    const generatedPolicy = result.current.accessPolicies.find(
      (policy) => policy.id === registration.value.apiKey.accessPolicyId,
    )
    expect(generatedPolicy).toMatchObject({
      managementType: "system-managed",
      effect: "allow",
      status: "active",
      resources: credentialEndpointIds.map((id) => ({
        type: "endpoint",
        id,
      })),
    })
    expect(
      result.current.accessPolicyAssignments.some(
        (assignment) =>
          assignment.accessPolicyId === generatedPolicy?.id &&
          assignment.targetType === "application" &&
          assignment.targetId === application.value.id,
      ),
    ).toBe(true)
    if (!generatedPolicy) return
    expect(
      await act(() =>
        result.current.updateAccessPolicy(
          generatedPolicy.id,
          { ...generatedPolicy, name: "변경할 수 없는 시스템 정책" },
          seededUserId,
        ),
      ),
    ).toEqual({ ok: false, error: "policy-operation-forbidden" })
    expect(
      await act(() =>
        result.current.deleteAccessPolicy(generatedPolicy.id, seededUserId),
      ),
    ).toEqual({ ok: false, error: "policy-operation-forbidden" })
    expect(
      await act(() =>
        result.current.assignAccessPoliciesToTarget(
          [generatedPolicy.id],
          "role",
          result.current.systemReferences.roleIds.administrator,
          seededUserId,
        ),
      ),
    ).toEqual({ ok: false, error: "policy-assignment-forbidden" })
    expect(
      await act(() =>
        result.current.deleteApplication(application.value.id, seededUserId),
      ),
    ).toEqual({ ok: false, error: "protected-relationship" })
    expect(result.current.apiKeys).toHaveLength(1)
    expect(result.current.notifications.at(-1)).toMatchObject({
      userId: requester.value.id,
      event: "api-key-issued",
      targetType: "approval-document",
      targetId: document.value.id,
    })
    expect(document.value).not.toHaveProperty("environment")
    expect(registration.value.apiKey).not.toHaveProperty("environment")
    expect(
      await act(() =>
        result.current.registerApiKey({
          approvalDocumentId: document.value.id,
          registeredByUserId: requester.value.id,
        }),
      ),
    ).toEqual({ ok: false, error: "api-key-already-registered" })
    const firstApprovalStep = document.value.approvalSteps[0]
    if (!firstApprovalStep) return
    const duplicateApproval = await act(() =>
      result.current.processApprovalDocument({
        documentId: document.value.id,
        actorUserId: requester.value.id,
        stepId: firstApprovalStep.id,
        decision: "approve",
        comment: "중복 승인",
      }),
    )
    expect(duplicateApproval).toEqual({
      ok: false,
      error: "approval-document-not-submitted",
    })

    const duplicateDocument = await act(() =>
      result.current.createApprovalDocument({
        documentKind: "api-key-issuance",
        title: "추가 자격증명 발급",
        type: "api-key",
        organizationId: organization.value.id,
        requesterId: requester.value.id,
        approvalLineId: line.value.id,
        content: "서비스 소유 조직의 자격증명 등록 흐름을 검증합니다.",
        fieldValues: [],
        approvalSteps: approvalStepsFromTemplate(
          result.current,
          line.value,
          requester.value.id,
          organization.value.id,
          { serviceOwnerOrganizationId: service.value.ownerOrganizationId },
        ),
        submission: "submitted",
        applicationId: application.value.id,
        serviceId: service.value.id,
        endpointIds: credentialEndpointIds,
        keyName: "secondary-integration",
        awsSecretName: "backoffice/partner-api",
        awsSecretKey: "secondary-integration",
      }),
    )
    expect(duplicateDocument).toEqual({
      ok: false,
      error: "credential-already-owned",
    })
    const secondRequester = await act(() =>
      result.current.createUser({
        nickname: "credential-owner",
        email: "credential-owner@example.com",
        employmentStatus: "employed",
        organizationIds: [organization.value.id],
      }),
    )
    if (!secondRequester.ok) return
    const secondApplication = await act(() =>
      result.current.createApplication(
        {
          name: "Secondary Console",
          slug: "secondary_console",
          description: "두 번째 자격증명 흐름을 검증하는 어플리케이션입니다.",
          ownerOrganizationId: organization.value.id,
        },
        seededUserId,
      ),
    )
    if (!secondApplication.ok) return
    const secondDocument = await act(() =>
      result.current.createApprovalDocument({
        documentKind: "api-key-issuance",
        title: "다른 사용자 자격증명 발급",
        type: "api-key",
        organizationId: organization.value.id,
        requesterId: secondRequester.value.id,
        approvalLineId: line.value.id,
        content: "다른 사용자의 서비스 자격증명 등록 흐름을 검증합니다.",
        fieldValues: [],
        approvalSteps: approvalStepsFromTemplate(
          result.current,
          line.value,
          secondRequester.value.id,
          organization.value.id,
          { serviceOwnerOrganizationId: service.value.ownerOrganizationId },
        ),
        submission: "submitted",
        applicationId: secondApplication.value.id,
        serviceId: service.value.id,
        endpointIds: credentialEndpointIds,
        keyName: "secondary-integration",
        awsSecretName: "backoffice/partner-api",
        awsSecretKey: "secondary-integration",
      }),
    )
    if (!secondDocument.ok) return
    await act(() =>
      completeApprovalDocument(result.current, secondDocument.value.id),
    )
    const outsider = await act(() =>
      result.current.createUser({
        nickname: "credential-outsider",
        email: "credential-outsider@example.com",
        employmentStatus: "employed",
        organizationIds: [seededOrganizationId],
      }),
    )
    if (!outsider.ok) return
    expect(
      await act(() =>
        result.current.registerApiKey({
          approvalDocumentId: secondDocument.value.id,
          registeredByUserId: outsider.value.id,
        }),
      ),
    ).toEqual({ ok: false, error: "api-key-registration-forbidden" })
    const ownerRegistration = await act(() =>
      result.current.registerApiKey({
        approvalDocumentId: secondDocument.value.id,
        registeredByUserId: requester.value.id,
      }),
    )
    expect(ownerRegistration.ok).toBe(true)
    if (!ownerRegistration.ok) return
    expect(ownerRegistration.value.secret).toMatch(/^bok_[a-f0-9]{32}$/)
    expect(ownerRegistration.value.apiKey).toMatchObject({
      registeredByUserId: requester.value.id,
    })
    expect(ownerRegistration.value.apiKey).not.toHaveProperty(
      "registrationMethod",
    )
  })

  it("replaces and disposes an API key through linked request templates", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: FixtureWrapper,
    })
    const apiKey = result.current.apiKeys[0]
    const issuanceDocument = result.current.approvalDocuments.find(
      (document) => document.id === apiKey?.approvalDocumentId,
    )
    const service = result.current.services.find(
      (item) => item.id === apiKey?.serviceId,
    )
    if (
      !apiKey ||
      issuanceDocument?.documentKind !== "api-key-issuance" ||
      !service
    ) {
      throw new Error("Credential fixture is incomplete")
    }
    const replacementTemplate = result.current.approvalLines.find(
      (template) => template.id === service.credentialTemplateIds.replacement,
    )
    const disposalTemplate = result.current.approvalLines.find(
      (template) => template.id === service.credentialTemplateIds.disposal,
    )
    const administrator = result.current.users.find(
      (user) => user.nickname === "David",
    )
    if (!replacementTemplate || !disposalTemplate || !administrator) {
      throw new Error("Credential lifecycle fixture is incomplete")
    }

    const replacement = await act(() =>
      result.current.createApprovalDocument({
        documentKind: "api-key-lifecycle",
        type: "api-key-replace",
        title: `API Key 교체 요청: ${apiKey.name}`,
        organizationId: issuanceDocument.organizationId,
        requesterId: issuanceDocument.requesterId,
        approvalLineId: replacementTemplate.id,
        apiKeyId: apiKey.id,
        awsSecretName: "backoffice/developer-api",
        awsSecretKey: "local-integration-key-next",
        content: "정기 교체 주기에 따라 API Key 교체를 요청합니다.",
        fieldValues: [],
        approvalSteps: approvalStepsFromTemplate(
          result.current,
          replacementTemplate,
          issuanceDocument.requesterId,
          issuanceDocument.organizationId,
          { serviceOwnerOrganizationId: service.ownerOrganizationId },
        ),
        submission: "submitted",
      }),
    )
    expect(replacement.ok).toBe(true)
    if (!replacement.ok) return
    expect(
      await act(() =>
        completeApprovalDocument(result.current, replacement.value.id),
      ),
    ).toMatchObject({ ok: true })

    const registration = await act(() =>
      result.current.registerApiKey({
        approvalDocumentId: replacement.value.id,
        registeredByUserId: administrator.id,
      }),
    )
    expect(registration.ok).toBe(true)
    if (!registration.ok) return
    expect(registration.value.apiKey).toMatchObject({
      name: apiKey.name,
      serviceId: apiKey.serviceId,
      replacesApiKeyId: apiKey.id,
      awsSecretName: "backoffice/developer-api",
      awsSecretKey: "local-integration-key-next",
      status: "active",
    })
    expect(
      result.current.apiKeys.find((item) => item.id === apiKey.id)?.status,
    ).toBe("inactive")

    const disposal = await act(() =>
      result.current.createApprovalDocument({
        documentKind: "api-key-lifecycle",
        type: "api-key-dispose",
        title: `API Key 폐기 요청: ${registration.value.apiKey.name}`,
        organizationId: issuanceDocument.organizationId,
        requesterId: issuanceDocument.requesterId,
        approvalLineId: disposalTemplate.id,
        apiKeyId: registration.value.apiKey.id,
        content: "더 이상 사용하지 않는 API Key의 폐기를 요청합니다.",
        fieldValues: [],
        approvalSteps: approvalStepsFromTemplate(
          result.current,
          disposalTemplate,
          issuanceDocument.requesterId,
          issuanceDocument.organizationId,
          { serviceOwnerOrganizationId: service.ownerOrganizationId },
        ),
        submission: "submitted",
      }),
    )
    expect(disposal.ok).toBe(true)
    if (!disposal.ok) return
    expect(
      await act(() =>
        completeApprovalDocument(result.current, disposal.value.id),
      ),
    ).toMatchObject({ ok: true })
    expect(
      result.current.apiKeys.find(
        (item) => item.id === registration.value.apiKey.id,
      )?.status,
    ).toBe("inactive")
    expect(
      result.current.accessPolicies.find(
        (policy) => policy.id === registration.value.apiKey.accessPolicyId,
      )?.status,
    ).toBe("inactive")
  })

  it("requires a manual key for EXTERNAL registration and never stores its value", async () => {
    const sourceDocument = localFixture.approvalDocuments.find(
      (document) => document.documentKind === "api-key-issuance",
    )
    const externalService = localFixture.services.find(
      (service) => service.type === "external",
    )
    const administrator = localFixture.users.find(
      (user) => user.nickname === "David",
    )
    if (!sourceDocument || !externalService || !administrator) {
      throw new Error("EXTERNAL registration fixture is incomplete")
    }
    const approvalDocumentId = "50000000-0000-4000-8000-000000000099"
    const state: BackofficeState = {
      ...localFixture,
      approvalDocuments: [
        ...localFixture.approvalDocuments,
        {
          ...sourceDocument,
          id: approvalDocumentId,
          title: "협업 SaaS API Key 발급 요청",
          serviceId: externalService.id,
          endpointIds: [],
          keyName: "collaboration-key",
          awsSecretName: "backoffice/collaboration-saas",
          awsSecretKey: "api-key",
        },
      ],
    }
    function ExternalWrapper({ children }: { children: ReactNode }) {
      return (
        <BackofficeProvider
          initialState={state}
          apiClientFactory={testApiClientFactory}
        >
          {children}
        </BackofficeProvider>
      )
    }
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: ExternalWrapper,
    })

    expect(
      await act(() =>
        result.current.registerApiKey({
          approvalDocumentId,
          registeredByUserId: administrator.id,
        }),
      ),
    ).toEqual({ ok: false, error: "invalid-input" })

    const manualSecret = "external-secret-value"
    const registration = await act(() =>
      result.current.registerApiKey({
        approvalDocumentId,
        registeredByUserId: administrator.id,
        secret: manualSecret,
      }),
    )

    expect(registration.ok).toBe(true)
    if (!registration.ok) return
    expect(registration.value.secret).toBeNull()
    expect(registration.value.apiKey).toMatchObject({
      awsSecretName: "backoffice/collaboration-saas",
      awsSecretKey: "api-key",
      accessPolicyId: null,
    })
    expect(JSON.stringify(result.current)).not.toContain(manualSecret)
  })

  it("does not create an API key when the INTERNAL registration API fails", async () => {
    const sourceDocument = localFixture.approvalDocuments.find(
      (document) => document.documentKind === "api-key-issuance",
    )
    const administrator = localFixture.users.find(
      (user) => user.nickname === "David",
    )
    if (!sourceDocument || !administrator) {
      throw new Error("INTERNAL registration fixture is incomplete")
    }
    const approvalDocumentId = "50000000-0000-4000-8000-000000000098"
    const state: BackofficeState = {
      ...localFixture,
      approvalDocuments: [
        ...localFixture.approvalDocuments,
        {
          ...sourceDocument,
          id: approvalDocumentId,
          title: "실패 검증 API Key 발급 요청",
          keyName: "failed-registration",
          awsSecretKey: "failed-registration",
        },
      ],
    }
    const failingRegistrar: InternalCredentialRegistrar = {
      register() {
        return Promise.reject(new Error("Registration service unavailable"))
      },
    }
    function FailingWrapper({ children }: { children: ReactNode }) {
      return (
        <BackofficeProvider
          initialState={state}
          apiClientFactory={createTestApiClientFactory(failingRegistrar)}
        >
          {children}
        </BackofficeProvider>
      )
    }
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: FailingWrapper,
    })
    const before = result.current.apiKeys.length

    expect(
      await act(() =>
        result.current.registerApiKey({
          approvalDocumentId,
          registeredByUserId: administrator.id,
        }),
      ),
    ).toEqual({
      ok: false,
      error: "internal-credential-registration-failed",
    })
    expect(result.current.apiKeys).toHaveLength(before)
  })

  it("creates permission requests only from a linked access policy", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: FixtureWrapper,
    })
    const policy = localFixture.accessPolicies[0]
    if (!policy) throw new Error("Access policy fixture is missing")
    const line = localFixture.approvalLines.find(
      (item) =>
        item.status === "active" &&
        item.category === "permission" &&
        item.type === policy.type,
    )
    if (!line) throw new Error("Access policy approval line is missing")
    const requester = localFixture.users.find(
      (item) => item.nickname === "Amelia",
    )
    if (!requester) throw new Error("Access policy requester is missing")
    const requestOrganizationId = requester.organizationIds[0]
    if (!requestOrganizationId)
      throw new Error("Requester organization missing")

    const missingPolicy = await act(() =>
      result.current.createApprovalDocument({
        documentKind: "general",
        title: "운영 모니터링 정책 적용",
        type: "access-grant",
        organizationId: requestOrganizationId,
        requesterId: requester.id,
        approvalLineId: line.id,
        accessPolicyId: crypto.randomUUID(),
        expiresAt: "2027-08-15T00:00:00.000Z",
        content: "운영 모니터링 기능 묶음의 접근 정책 적용을 요청합니다.",
        fieldValues: [],
        approvalSteps: approvalStepsFromTemplate(
          result.current,
          line,
          requester.id,
          requestOrganizationId,
        ),
        submission: "submitted",
      }),
    )
    expect(missingPolicy).toEqual({
      ok: false,
      error: "approval-reference-mismatch",
    })

    const document = await act(() =>
      result.current.createApprovalDocument({
        documentKind: "general",
        title: "운영 모니터링 정책 적용",
        type: "access-grant",
        organizationId: requestOrganizationId,
        requesterId: requester.id,
        approvalLineId: line.id,
        accessPolicyId: policy.id,
        expiresAt: "2027-08-15T00:00:00.000Z",
        content: "운영 모니터링 기능 묶음의 접근 정책 적용을 요청합니다.",
        fieldValues: [],
        approvalSteps: approvalStepsFromTemplate(
          result.current,
          line,
          requester.id,
          requestOrganizationId,
        ),
        submission: "submitted",
      }),
    )
    expect(document.ok).toBe(true)
    if (!document.ok) return
    expect(document.value).toMatchObject({
      documentKind: "general",
      type: "access-grant",
      accessPolicyId: policy.id,
    })
    expect(
      await act(() =>
        completeApprovalDocument(result.current, document.value.id),
      ),
    ).toMatchObject({ ok: true })
    expect(
      await act(() =>
        result.current.createApprovalDocument({
          documentKind: "general",
          title: "운영 모니터링 정책 재요청",
          type: "access-grant",
          organizationId: requestOrganizationId,
          requesterId: requester.id,
          approvalLineId: line.id,
          accessPolicyId: policy.id,
          expiresAt: "2027-08-15T00:00:00.000Z",
          content: "이미 보유한 운영 모니터링 정책을 다시 요청합니다.",
          fieldValues: [],
          approvalSteps: approvalStepsFromTemplate(
            result.current,
            line,
            requester.id,
            requestOrganizationId,
          ),
          submission: "submitted",
        }),
      ),
    ).toEqual({ ok: false, error: "access-policy-already-assigned" })
  })

  it("allows a request-time approver to replace an unresolved template assignee", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: FixtureWrapper,
    })
    const requester = localFixture.users.find(
      (user) => user.nickname === "Jhonny",
    )
    const requestOrganization = localFixture.organizations.find(
      (organization) => organization.name === "개발실",
    )
    const service = localFixture.services.find(
      (candidate) => candidate.name === "Developer API",
    )
    const template = localFixture.approvalLines.find(
      (candidate) => candidate.id === service?.credentialTemplateIds.issuance,
    )
    const fallbackApprover = localFixture.users.find(
      (user) => user.nickname === "David",
    )
    const unresolvedStep = template?.steps.find(
      (step) => step.assigneeMode === "request-organization-leader",
    )
    const application = localFixture.applications.find(
      (candidate) => candidate.ownerOrganizationId === requestOrganization?.id,
    )
    if (
      !requester ||
      !requestOrganization ||
      !service ||
      !template ||
      !application ||
      !fallbackApprover ||
      !unresolvedStep
    ) {
      throw new Error("Credential approver fixture is incomplete")
    }

    const response = await act(() =>
      result.current.createApprovalDocument({
        documentKind: "api-key-issuance",
        title: "상위 승인자 없는 자격증명 발급 요청",
        type: "api-key",
        organizationId: requestOrganization.id,
        requesterId: requester.id,
        approvalLineId: template.id,
        content: "상위 조직장이 없는 요청은 제출될 수 없습니다.",
        fieldValues: [],
        approvalSteps: approvalStepsFromTemplate(
          result.current,
          template,
          requester.id,
          requestOrganization.id,
          {
            serviceOwnerOrganizationId: service.ownerOrganizationId,
            userAssignments: {
              [unresolvedStep.id]: fallbackApprover.id,
            },
          },
        ),
        submission: "submitted",
        applicationId: application.id,
        serviceId: service.id,
        endpointIds: localFixture.serviceEndpoints
          .filter((endpoint) => endpoint.serviceId === service.id)
          .map((endpoint) => endpoint.id),
        keyName: "missing-upper-approver",
        awsSecretName: "backoffice/missing-upper-approver",
        awsSecretKey: "api-key",
      }),
    )

    expect(response.ok).toBe(true)
    if (!response.ok) return
    expect(
      response.value.approvalSteps.find((step) => step.id === unresolvedStep.id)
        ?.assigneeId,
    ).toBe(fallbackApprover.id)
    expect(
      localFixture.approvalLines
        .find((line) => line.id === template.id)
        ?.steps.find((step) => step.id === unresolvedStep.id)?.assigneeMode,
    ).toBe("request-organization-leader")
  })

  it("stores valid endpoints without status and rejects duplicate paths", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: FixtureWrapper,
    })
    const endpoint = localFixture.serviceEndpoints[0]
    if (!endpoint) throw new Error("Endpoint fixture is missing")

    const created = await act(() =>
      result.current.createServiceEndpoint({
        serviceId: endpoint.serviceId,
        name: "준비 상태 확인 API",
        method: "GET",
        path: "/ready",
        fields: [
          {
            location: "response-body",
            fieldPath: "$.ready",
            valueType: "boolean",
            required: true,
            description: "준비 여부",
          },
        ],
      }),
    )
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.value).not.toHaveProperty("status")
    expect(
      result.current.serviceEndpointFields.find(
        (field) => field.endpointId === created.value.id,
      ),
    ).toMatchObject({
      fieldPath: "$.ready",
      location: "response-body",
    })

    const duplicate = await act(() =>
      result.current.createServiceEndpoint({
        serviceId: endpoint.serviceId,
        name: "중복 상태 확인 API",
        method: "POST",
        path: endpoint.path,
        fields: fixtureEndpointFields(endpoint.id),
      }),
    )

    expect(duplicate).toEqual({ ok: false, error: "endpoint-exists" })
  })

  it("rejects endpoints for EXTERNAL services", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: FixtureWrapper,
    })
    const externalService = localFixture.services.find(
      (service) => service.type === "external",
    )
    if (!externalService) throw new Error("EXTERNAL service fixture is missing")

    const created = await act(() =>
      result.current.createServiceEndpoint({
        serviceId: externalService.id,
        name: "외부 SaaS API",
        method: "GET",
        path: "/users",
        fields: [],
      }),
    )

    expect(created).toEqual({
      ok: false,
      error: "endpoint-service-invalid",
    })

    const endpoint = localFixture.serviceEndpoints[0]
    if (!endpoint) throw new Error("Endpoint fixture is missing")
    const updated = await act(() =>
      result.current.updateServiceEndpoint(endpoint.id, {
        serviceId: externalService.id,
        name: endpoint.name,
        method: endpoint.method,
        path: endpoint.path,
        fields: fixtureEndpointFields(endpoint.id),
      }),
    )
    expect(updated).toEqual({
      ok: false,
      error: "endpoint-service-invalid",
    })
  })

  it("synchronizes the service operator role from organization changes", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: SeededWrapper,
    })
    const firstLeader = await act(() =>
      result.current.createUser({
        nickname: "first-leader",
        email: "first-leader@example.com",
        employmentStatus: "employed",
        organizationIds: [seededOrganizationId],
      }),
    )
    const secondLeader = await act(() =>
      result.current.createUser({
        nickname: "second-leader",
        email: "second-leader@example.com",
        employmentStatus: "employed",
        organizationIds: [seededOrganizationId],
      }),
    )
    if (!firstLeader.ok || !secondLeader.ok) return
    const organization = await act(() =>
      result.current.createOrganization({
        name: "조직장 역할 동기화 조직",
        leaderUserId: firstLeader.value.id,
      }),
    )
    if (!organization.ok) return

    expect(
      result.current.roles.find(
        (role) => role.id === defaultServiceOperatorRole.id,
      )?.userIds,
    ).toEqual([seededUserId, firstLeader.value.id])

    await act(() =>
      result.current.updateOrganization(organization.value.id, {
        name: organization.value.name,
        leaderUserId: secondLeader.value.id,
      }),
    )
    expect(
      result.current.roles.find(
        (role) => role.id === defaultServiceOperatorRole.id,
      )?.userIds,
    ).toEqual([seededUserId, secondLeader.value.id])
    expect(
      await act(() =>
        result.current.assignUsersToRoles(
          [firstLeader.value.id],
          [defaultServiceOperatorRole.id],
        ),
      ),
    ).toEqual({ ok: false, error: "protected-relationship" })
  })

  it("updates and deletes services while protecting connected resources", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: FixtureWrapper,
    })
    const service = localFixture.services.find(
      (item) => item.name === "협업 SaaS",
    )
    const protectedService = localFixture.services.find(
      (item) => item.name === "Developer API",
    )
    if (!service || !protectedService) {
      throw new Error("Service fixtures are missing")
    }

    const updated = await act(() =>
      result.current.updateService(service.id, {
        name: "협업 도구 SaaS",
        slug: service.slug,
        host: service.host,
        type: service.type,
        ownerOrganizationId: service.ownerOrganizationId,
        credentialTemplateIds: service.credentialTemplateIds,
      }),
    )
    expect(updated.ok && updated.value.name).toBe("협업 도구 SaaS")
    expect(
      await act(() => result.current.deleteService(protectedService.id)),
    ).toEqual({ ok: false, error: "protected-relationship" })
    expect(
      await act(() =>
        result.current.updateService(protectedService.id, {
          name: protectedService.name,
          slug: protectedService.slug,
          host: protectedService.host,
          type: "external",
          ownerOrganizationId: protectedService.ownerOrganizationId,
          credentialTemplateIds: protectedService.credentialTemplateIds,
        }),
      ),
    ).toEqual({ ok: false, error: "protected-relationship" })
    const deleted = await act(() => result.current.deleteService(service.id))
    expect(deleted.ok && deleted.value.id).toBe(service.id)
    expect(result.current.services.some((item) => item.id === service.id)).toBe(
      false,
    )
  })

  it("updates and deletes endpoints without weakening duplicate validation", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: FixtureWrapper,
    })
    const [firstEndpoint, secondEndpoint] = localFixture.serviceEndpoints
    if (!firstEndpoint || !secondEndpoint) {
      throw new Error("Endpoint fixtures are missing")
    }
    const originalFields = fixtureEndpointFields(firstEndpoint.id)
    const originalField = originalFields[0]
    if (!originalField) throw new Error("Endpoint field fixture is missing")
    const originalFieldIds = originalFields.map(
      (field) =>
        localFixture.serviceEndpointFields.find(
          (candidate) =>
            candidate.endpointId === firstEndpoint.id &&
            candidate.location === field.location &&
            candidate.fieldPath === field.fieldPath,
        )?.id,
    )

    const duplicate = await act(() =>
      result.current.updateServiceEndpoint(firstEndpoint.id, {
        serviceId: firstEndpoint.serviceId,
        name: firstEndpoint.name,
        method: firstEndpoint.method,
        path: secondEndpoint.path,
        fields: fixtureEndpointFields(firstEndpoint.id),
      }),
    )
    expect(duplicate).toEqual({ ok: false, error: "endpoint-exists" })

    const updated = await act(() =>
      result.current.updateServiceEndpoint(firstEndpoint.id, {
        serviceId: firstEndpoint.serviceId,
        name: "상태 점검 API",
        method: firstEndpoint.method,
        path: "/status",
        fields: fixtureEndpointFields(firstEndpoint.id),
      }),
    )
    expect(updated.ok && updated.value.path).toBe("/status")
    expect(
      result.current.serviceEndpointFields
        .filter((field) => field.endpointId === firstEndpoint.id)
        .map((field) => field.id),
    ).toEqual(originalFieldIds)
    const changedField = await act(() =>
      result.current.updateServiceEndpoint(firstEndpoint.id, {
        serviceId: firstEndpoint.serviceId,
        name: "상태 점검 API",
        method: firstEndpoint.method,
        path: "/status",
        fields: [{ ...originalField, fieldPath: "$.serviceStatus" }],
      }),
    )
    expect(changedField.ok).toBe(true)
    expect(
      result.current.serviceEndpointFields.find(
        (field) =>
          field.endpointId === firstEndpoint.id &&
          field.fieldPath === "$.serviceStatus",
      )?.id,
    ).not.toBe(originalFieldIds[0])
    expect(
      await act(() => result.current.deleteServiceEndpoint(firstEndpoint.id)),
    ).toEqual({ ok: false, error: "protected-relationship" })

    const removable = await act(() =>
      result.current.createServiceEndpoint({
        serviceId: firstEndpoint.serviceId,
        name: "삭제 검증 API",
        method: "GET",
        path: "/deletion-test",
        fields: [
          {
            location: "query",
            fieldPath: "$.cursor",
            valueType: "string",
            required: false,
            description: "삭제 검증용 커서",
          },
        ],
      }),
    )
    if (!removable.ok) throw new Error("Removable endpoint creation failed")
    const deleted = await act(() =>
      result.current.deleteServiceEndpoint(removable.value.id),
    )
    expect(deleted.ok && deleted.value.id).toBe(removable.value.id)
    expect(
      result.current.serviceEndpoints.some(
        (endpoint) => endpoint.id === removable.value.id,
      ),
    ).toBe(false)
    expect(
      result.current.serviceEndpointFields.some(
        (field) => field.endpointId === removable.value.id,
      ),
    ).toBe(false)
  })

  it("imports UI Resources by key and isolates identical keys by namespace", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: FixtureWrapper,
    })
    const administrator = localFixture.users.find(
      (user) => user.nickname === "David",
    )
    const policyOperator = localFixture.users.find(
      (user) => user.nickname === "Owen",
    )
    const generalUser = localFixture.users.find(
      (user) => user.nickname === "Emma",
    )
    if (!administrator || !policyOperator || !generalUser) {
      throw new Error("UI Resource import fixtures are missing")
    }
    const manifest: UiResourceManifest = {
      version: 1,
      namespaceKey: "backoffice",
      resources: [
        ...uiResourceManifest.resources,
        {
          key: "services:list:catalogTable",
          parentKey: "services:list",
          type: "component",
          name: "서비스 카탈로그 테이블",
          description: "서비스 카탈로그 목록을 조회하는 테이블입니다.",
        },
      ],
    }

    const imported = await act(() =>
      result.current.importUiResources(
        { manifest, grantManagerAccess: false },
        policyOperator.id,
      ),
    )
    expect(imported.ok).toBe(true)
    if (!imported.ok) return
    expect(imported.value).toMatchObject({
      addedCount: 1,
      updatedCount: uiResourceManifest.resources.length,
      orphanedCount: 0,
    })
    const created = result.current.uiResources.find(
      (resource) => resource.key === "services:list:catalogTable",
    )
    expect(created?.namespaceId).toBeDefined()
    const managerPolicy = result.current.accessPolicies.find(
      (policy) =>
        policy.id ===
        result.current.namespaces.find(
          (namespace) => namespace.key === manifest.namespaceKey,
        )?.managerAccessPolicyId,
    )
    expect(
      managerPolicy?.resources.some(
        (resource) =>
          resource.type === "ui-resource" && resource.id === created?.id,
      ),
    ).toBe(false)
    if (!created) throw new Error("Imported UI resource is missing")
    expect(
      await act(() =>
        result.current.setUiResourceStatus(
          created.id,
          "inactive",
          policyOperator.id,
        ),
      ),
    ).toMatchObject({ ok: true, value: { status: "inactive" } })

    const updated = await act(() =>
      result.current.importUiResources(
        {
          manifest: {
            ...manifest,
            resources: manifest.resources.map((resource) =>
              resource.key === "services:list:catalogTable"
                ? { ...resource, name: "서비스 목록 테이블" }
                : resource,
            ),
          },
          grantManagerAccess: true,
        },
        policyOperator.id,
      ),
    )
    expect(updated.ok && updated.value).toMatchObject({
      addedCount: 0,
      updatedCount: manifest.resources.length,
      orphanedCount: 0,
    })
    expect(
      result.current.uiResources.find(
        (resource) => resource.key === "services:list:catalogTable",
      ),
    ).toMatchObject({
      id: created.id,
      name: "서비스 목록 테이블",
      status: "inactive",
    })
    expect(
      await act(() =>
        result.current.importUiResources(
          { manifest, grantManagerAccess: true },
          generalUser.id,
        ),
      ),
    ).toEqual({ ok: false, error: "ui-resource-import-forbidden" })
    expect(
      await act(() =>
        result.current.importUiResources(
          { manifest, grantManagerAccess: true },
          policyOperator.id,
        ),
      ),
    ).toMatchObject({ ok: true })
    expect(
      await act(() =>
        result.current.importUiResources(
          {
            manifest: {
              version: 1,
              namespaceKey: "backoffice",
              resources: [
                {
                  key: "unknown:submit",
                  parentKey: "unknown",
                  type: "action",
                  name: "알 수 없는 제출 액션",
                  description: "존재하지 않는 부모 key를 검증합니다.",
                },
              ],
            },
            grantManagerAccess: true,
          },
          policyOperator.id,
        ),
      ),
    ).toEqual({ ok: false, error: "ui-resource-parent-not-found" })
    const namespace = await act(() =>
      result.current.createNamespace(
        {
          key: "customer-console",
          name: "Customer Console",
          description: "고객 시스템의 UI Resource를 격리합니다.",
          managerRoleId: defaultBackofficeAdminRole.id,
        },
        administrator.id,
      ),
    )
    expect(namespace.ok).toBe(true)
    if (!namespace.ok) return
    const newNamespaceManagerPolicy = result.current.accessPolicies.find(
      (policy) => policy.id === namespace.value.managerAccessPolicyId,
    )
    expect(newNamespaceManagerPolicy?.resources).toHaveLength(
      uiResourceManagerUiResourceKeys.length + 1,
    )
    expect(newNamespaceManagerPolicy?.resources).toEqual(
      expect.arrayContaining([
        {
          type: "endpoint",
          id: result.current.systemReferences.serviceEndpointIds
            .importUiResources,
        },
      ]),
    )
    const managementResourceIds = new Set(
      result.current.uiResources
        .filter(
          (resource) =>
            resource.namespaceId === defaultNamespace.id &&
            uiResourceManagerUiResourceKeys.includes(resource.key),
        )
        .map((resource) => resource.id),
    )
    expect(
      newNamespaceManagerPolicy?.resources.filter(
        (resource) =>
          resource.type === "ui-resource" &&
          managementResourceIds.has(resource.id),
      ),
    ).toHaveLength(uiResourceManagerUiResourceKeys.length)
    expect(
      result.current.accessPolicyAssignments.some(
        (assignment) =>
          assignment.accessPolicyId === newNamespaceManagerPolicy?.id &&
          assignment.targetType === "role" &&
          assignment.targetId === defaultBackofficeAdminRole.id,
      ),
    ).toBe(true)
    expect(
      await act(() =>
        result.current.importUiResources(
          {
            manifest: {
              version: 1,
              namespaceKey: namespace.value.key,
              resources: [
                {
                  key: "services",
                  parentKey: null,
                  type: "menu",
                  name: "서비스",
                  description: "고객 시스템의 서비스 메뉴입니다.",
                },
              ],
            },
            grantManagerAccess: true,
          },
          generalUser.id,
        ),
      ),
    ).toEqual({ ok: false, error: "ui-resource-import-forbidden" })
    const isolatedImport = await act(() =>
      result.current.importUiResources(
        {
          manifest: {
            version: 1,
            namespaceKey: namespace.value.key,
            resources: [
              {
                key: "services",
                parentKey: null,
                type: "menu",
                name: "서비스",
                description: "고객 시스템의 서비스 메뉴입니다.",
              },
              {
                key: "services:list",
                parentKey: "services",
                type: "view",
                name: "서비스 목록",
                description: "고객 시스템의 서비스 목록 화면입니다.",
              },
              {
                key: "services:list:catalogTable",
                parentKey: "services:list",
                type: "component",
                name: "서비스 카탈로그 테이블",
                description: "고객 시스템의 서비스 목록입니다.",
              },
            ],
          },
          grantManagerAccess: true,
        },
        administrator.id,
      ),
    )
    expect(isolatedImport.ok).toBe(true)
    expect(
      result.current.uiResources
        .filter((resource) => resource.key === "services:list:catalogTable")
        .map((resource) => resource.namespaceId),
    ).toEqual([expect.any(String), namespace.value.id])
    const orphaned = await act(() =>
      result.current.importUiResources(
        {
          manifest: {
            version: 1,
            namespaceKey: namespace.value.key,
            resources: [
              {
                key: "services",
                parentKey: null,
                type: "menu",
                name: "서비스",
                description: "고객 시스템의 서비스 메뉴입니다.",
              },
              {
                key: "services:list",
                parentKey: "services",
                type: "view",
                name: "서비스 목록",
                description: "고객 시스템의 서비스 목록 화면입니다.",
              },
            ],
          },
          grantManagerAccess: true,
        },
        administrator.id,
      ),
    )
    expect(orphaned.ok && orphaned.value.orphanedCount).toBe(1)
    const orphanedResource = result.current.uiResources.find(
      (resource) =>
        resource.namespaceId === namespace.value.id &&
        resource.key === "services:list:catalogTable",
    )
    expect(orphanedResource?.orphanedAt).not.toBeNull()
    expect(
      result.current.namespaces.find((item) => item.id === namespace.value.id)
        ?.lastSyncedAt,
    ).toBe(orphanedResource?.orphanedAt)
    if (!orphanedResource) throw new Error("Orphaned UI Resource is missing")
    expect(
      await act(() =>
        result.current.deleteOrphanedUiResources(
          [orphanedResource.id],
          generalUser.id,
        ),
      ),
    ).toEqual({ ok: false, error: "ui-resource-delete-forbidden" })
    const removed = await act(() =>
      result.current.deleteOrphanedUiResources(
        [orphanedResource.id],
        administrator.id,
      ),
    )
    expect(removed.ok && removed.value).toHaveLength(1)
    expect(
      result.current.uiResources.some(
        (resource) => resource.id === orphanedResource.id,
      ),
    ).toBe(false)
    expect(
      await act(() =>
        result.current.createNamespace(
          {
            key: "customer-console",
            name: "Another Console",
            description: "중복 key 검증용 namespace입니다.",
            managerRoleId: defaultBackofficeAdminRole.id,
          },
          administrator.id,
        ),
      ),
    ).toEqual({ ok: false, error: "namespace-key-exists" })
    expect(
      await act(() =>
        result.current.createNamespace(
          {
            key: "forbidden-console",
            name: "Forbidden Console",
            description: "권한 검증용 namespace입니다.",
            managerRoleId: defaultBackofficeAdminRole.id,
          },
          generalUser.id,
        ),
      ),
    ).toEqual({ ok: false, error: "namespace-operation-forbidden" })
  })

  it("requires the management role, synchronization UI action, and API endpoint access", async () => {
    const manager = localFixture.users.find((user) => user.nickname === "Owen")
    const importAction = localFixture.uiResources.find(
      (resource) =>
        resource.namespaceId === defaultNamespace.id &&
        resource.key ===
          uiResourceKeys.uiResources.list.actions.importUiResources,
    )
    if (!manager || !importAction) {
      throw new Error("UI resource synchronization fixtures are missing")
    }
    const requiredResources = [
      { type: "ui-resource", id: importAction.id },
      {
        type: "endpoint",
        id: localFixture.systemReferences.serviceEndpointIds.importUiResources,
      },
    ] as const

    for (const missing of requiredResources) {
      const state = structuredClone(localFixture)
      state.accessPolicies = state.accessPolicies.map((policy) => ({
        ...policy,
        resources: policy.resources.filter(
          (resource) =>
            resource.type !== missing.type || resource.id !== missing.id,
        ),
      }))
      function MissingPermissionWrapper({ children }: { children: ReactNode }) {
        return (
          <BackofficeProvider
            initialState={state}
            apiClientFactory={testApiClientFactory}
          >
            {children}
          </BackofficeProvider>
        )
      }
      const { result, unmount } = renderHook(() => useBackoffice(), {
        wrapper: MissingPermissionWrapper,
      })

      expect(
        await act(() =>
          result.current.importUiResources(
            {
              manifest: uiResourceManifest,
              grantManagerAccess: false,
            },
            manager.id,
          ),
        ),
      ).toEqual({ ok: false, error: "ui-resource-import-forbidden" })
      unmount()
    }

    const stateWithoutManagementRole = structuredClone(localFixture)
    stateWithoutManagementRole.roles = stateWithoutManagementRole.roles.map(
      (role) =>
        role.id === defaultNamespace.managerRoleId
          ? {
              ...role,
              userIds: role.userIds.filter((userId) => userId !== manager.id),
              organizationIds: [],
            }
          : role,
    )
    function MissingManagementRoleWrapper({
      children,
    }: {
      children: ReactNode
    }) {
      return (
        <BackofficeProvider
          initialState={stateWithoutManagementRole}
          apiClientFactory={testApiClientFactory}
        >
          {children}
        </BackofficeProvider>
      )
    }
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: MissingManagementRoleWrapper,
    })
    expect(
      await act(() =>
        result.current.importUiResources(
          { manifest: uiResourceManifest, grantManagerAccess: false },
          manager.id,
        ),
      ),
    ).toEqual({ ok: false, error: "ui-resource-import-forbidden" })
  })

  it("submits a draft, withdraws, rejects, and resubmits an access request", async () => {
    const { result } = renderHook(() => useBackoffice(), {
      wrapper: FixtureWrapper,
    })
    const requester = result.current.users.find(
      (user) => user.nickname === "Amelia",
    )
    const approver = result.current.users.find(
      (user) => user.nickname === "Ethan",
    )
    const template = result.current.approvalLines.find(
      (line) => line.category === "permission" && line.status === "active",
    )
    const policy = result.current.accessPolicies.find(
      (candidate) => candidate.id === "43000000-0000-4000-8000-000000000001",
    )
    const organizationId = requester?.organizationIds[0]
    if (!requester || !approver || !template || !policy || !organizationId) {
      throw new Error("Access request fixtures are incomplete")
    }

    const created = await act(() =>
      result.current.createApprovalDocument({
        documentKind: "general",
        type: "access-grant",
        title: "운영 모니터링 접근 요청",
        organizationId,
        requesterId: requester.id,
        approvalLineId: template.id,
        accessPolicyId: policy.id,
        expiresAt: "2027-08-15T00:00:00.000Z",
        content: "운영 모니터링 업무를 수행하기 위해 접근을 요청합니다.",
        fieldValues: [],
        approvalSteps: approvalStepsFromTemplate(
          result.current,
          template,
          requester.id,
          organizationId,
        ),
        submission: "draft",
      }),
    )
    if (!created.ok) throw new Error(created.error)
    expect(created.value.status).toBe("draft")
    expect(
      created.value.approvalSteps.every((step) => step.status === "waiting"),
    ).toBe(true)

    const initialSubmission = await act(() =>
      result.current.resubmitApprovalDocument({
        documentId: created.value.id,
        actorUserId: requester.id,
      }),
    )
    if (!initialSubmission.ok) throw new Error(initialSubmission.error)
    expect(initialSubmission.value.document.approvalSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "request", status: "completed" }),
        expect.objectContaining({ kind: "approval", status: "pending" }),
      ]),
    )

    const withdrawn = await act(() =>
      result.current.withdrawApprovalDocument({
        documentId: created.value.id,
        actorUserId: requester.id,
      }),
    )
    expect(withdrawn).toMatchObject({
      ok: true,
      value: { status: "withdrawn" },
    })

    const resubmitted = await act(() =>
      result.current.resubmitApprovalDocument({
        documentId: created.value.id,
        actorUserId: requester.id,
      }),
    )
    if (!resubmitted.ok) throw new Error(resubmitted.error)
    const pendingStep = resubmitted.value.document.approvalSteps.find(
      (step) => step.status === "pending",
    )
    if (!pendingStep) throw new Error("Pending request step is missing")

    const rejected = await act(() =>
      result.current.processApprovalDocument({
        documentId: created.value.id,
        actorUserId: approver.id,
        stepId: pendingStep.id,
        decision: "reject",
        comment: "요청 사유를 보완해 주세요.",
      }),
    )
    expect(rejected).toMatchObject({
      ok: true,
      value: { document: { status: "rejected" } },
    })

    const finalSubmission = await act(() =>
      result.current.resubmitApprovalDocument({
        documentId: created.value.id,
        actorUserId: requester.id,
      }),
    )
    if (!finalSubmission.ok) throw new Error(finalSubmission.error)
    const finalStep = finalSubmission.value.document.approvalSteps.find(
      (step) => step.status === "pending",
    )
    if (!finalStep) throw new Error("Resubmitted request step is missing")
    const approved = await act(() =>
      result.current.processApprovalDocument({
        documentId: created.value.id,
        actorUserId: approver.id,
        stepId: finalStep.id,
        decision: "approve",
        comment: "보완 내용을 확인했습니다.",
      }),
    )
    expect(approved).toMatchObject({
      ok: true,
      value: { document: { status: "approved" } },
    })
  })
})
