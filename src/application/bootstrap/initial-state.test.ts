import { describe, expect, it } from "vitest"

import { applicationIdentity } from "@/config/application-identity"
import { z } from "zod"

import { resolveBackofficeAccess } from "@/auth/local-access"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { uiResourceKeys } from "@/config/menu-registry"
import {
  defaultGeneralUserRole,
  defaultIamOperatorRole,
  defaultPolicyOperatorRole,
  defaultServiceOperatorRole,
  defaultUiResourceManagerRole,
  initialBackofficeState,
} from "@/mocks/system-fixture"
import {
  localBackofficeDataSource,
  createBackofficeQueryClient,
} from "@/application/bootstrap/initial-state"

const uuidSchema = z.uuid()

describe("backoffice initial state", () => {
  it("loads local mock data only when the development source is explicit", async () => {
    await expect(
      (await createBackofficeQueryClient("development", undefined)).getSnapshot(
        {},
      ),
    ).resolves.toEqual({ data: initialBackofficeState })
    await expect(
      (
        await createBackofficeQueryClient(
          "development",
          localBackofficeDataSource,
        )
      ).getSnapshot({}),
    ).resolves.toEqual({ data: localFixture })
    await expect(
      createBackofficeQueryClient("development", "unknown"),
    ).rejects.toThrow("Unsupported backoffice data source")
    await expect(
      createBackofficeQueryClient("production", localBackofficeDataSource),
    ).rejects.toThrow("restricted to development")
  })

  it("exposes local session seed only through the bootstrap client", async () => {
    const defaultClient = await createBackofficeQueryClient(
      "development",
      undefined,
    )
    const localClient = await createBackofficeQueryClient(
      "development",
      localBackofficeDataSource,
    )

    await expect(defaultClient.getLocalSessionSeed()).resolves.toBeNull()
    await expect(localClient.getLocalSessionSeed()).resolves.toEqual({
      defaultUserId: localDefaultUserId,
    })
  })

  it.each(["api-key-replace", "api-key-dispose"] as const)(
    "loads the %s template as a Groo delegated draft",
    (type) => {
      const template = localFixture.approvalLines.find(
        (candidate) => candidate.type === type,
      )

      expect(template?.approvalExecution).toMatchObject({
        type: "groo",
        draftDocumentId:
          type === "api-key-replace"
            ? "GROO-CREDENTIAL-REPLACEMENT-V1"
            : "GROO-CREDENTIAL-DISPOSAL-V1",
      })
      expect(template?.steps).toEqual([])
    },
  )

  it("provides valid and unique entity identifiers", () => {
    const collections = [
      localFixture.organizations,
      localFixture.users,
      localFixture.roles,
      localFixture.approvalLines,
      localFixture.accessPolicies,
      localFixture.accessPolicyAssignments,
      localFixture.approvalDocuments,
      localFixture.notifications,
      localFixture.services,
      localFixture.serviceEndpoints,
      localFixture.serviceEndpointFields,
      localFixture.apiKeys,
      localFixture.namespaces,
      localFixture.uiResources,
    ]

    for (const collection of collections) {
      const ids = collection.map((item) => item.id)
      expect(ids.every((id) => uuidSchema.safeParse(id).success)).toBe(true)
      expect(new Set(ids).size).toBe(ids.length)
    }
    const requestFieldIds = localFixture.approvalLines.flatMap((template) =>
      template.fields.map((field) => field.id),
    )
    expect(
      requestFieldIds.every((id) => uuidSchema.safeParse(id).success),
    ).toBe(true)
    expect(new Set(requestFieldIds).size).toBe(requestFieldIds.length)
  })

  it("derives fixture email addresses from nicknames", () => {
    for (const user of localFixture.users) {
      expect(user.email).toBe(`${user.nickname.toLowerCase()}@example.com`)
    }
  })

  it("keeps every non-resigned fixture user in at least one organization", () => {
    expect(
      localFixture.users.every(
        (user) =>
          user.employmentStatus === "resigned" ||
          user.organizationIds.length > 0,
      ),
    ).toBe(true)
  })

  it("provides the local development and security organizations", () => {
    expect(
      localFixture.organizations.map((organization) => organization.name),
    ).toEqual([
      "개발 1팀",
      "개발 2팀",
      "개인정보보호팀",
      "보안성검토팀",
      "IT보안팀",
      "개발실",
    ])
  })

  it("assigns external services to the IT security organization", () => {
    const itSecurity = localFixture.organizations.find(
      (organization) => organization.name === "IT보안팀",
    )
    const externalServices = localFixture.services.filter(
      (service) => service.type === "external",
    )

    expect(itSecurity).toBeDefined()
    expect(externalServices.length).toBeGreaterThan(0)
    expect(
      externalServices.every(
        (service) => service.ownerOrganizationId === itSecurity?.id,
      ),
    ).toBe(true)
    expect(
      externalServices.every((service) =>
        localFixture.serviceEndpoints.every(
          (endpoint) => endpoint.serviceId !== service.id,
        ),
      ),
    ).toBe(true)
  })

  it("exposes Access Governance menu operations through the service catalog", () => {
    const backofficeService = localFixture.services.find(
      (service) => service.serviceKey === applicationIdentity.serviceKey,
    )
    const expectedMenuPaths = [
      "/v1/home/summary",
      "/v1/users/list",
      "/v1/organizations/list",
      "/v1/roles/list",
      "/v1/access-policies/list",
      "/v1/credentials/list",
      "/v1/requests/list",
      "/v1/request-templates/list",
      "/v1/services/list",
      "/v1/service-endpoints/list",
      "/v1/namespaces/list",
      "/v1/ui-resources/list",
      "/v1/audit-logs/list",
    ]

    expect(backofficeService).toBeDefined()
    const endpointPaths = new Set(
      localFixture.serviceEndpoints
        .filter((endpoint) => endpoint.serviceId === backofficeService?.id)
        .map((endpoint) => endpoint.path),
    )
    expect(expectedMenuPaths.every((path) => endpointPaths.has(path))).toBe(
      true,
    )
  })

  it("provides the system roles", () => {
    expect(localFixture.roles.map((role) => role.name)).toEqual([
      "Access Governance 시스템 관리자",
      "Access Governance 정책 운영자",
      "Access Governance IAM 운영자",
      "Access Governance 일반 사용자",
      "Access Governance UI 리소스 관리자",
      "Access Governance 서비스 운영자",
    ])
    expect(
      localFixture.roles.find((role) => role.id === defaultGeneralUserRole.id)
        ?.userIds,
    ).toEqual(localFixture.users.map((user) => user.id))
    expect(
      localFixture.roles.find(
        (role) =>
          role.id === localFixture.systemReferences.roleIds.administrator,
      ),
    ).toMatchObject({
      userIds: [
        localFixture.users.find((user) => user.nickname === "David")?.id,
      ],
      organizationIds: [],
    })
    expect(
      localFixture.roles.find((role) => role.id === defaultIamOperatorRole.id)
        ?.organizationIds,
    ).toEqual([
      localFixture.organizations.find(
        (organization) => organization.name === "개발 1팀",
      )?.id,
    ])
    expect(
      localFixture.roles.find(
        (role) => role.id === defaultPolicyOperatorRole.id,
      )?.userIds,
    ).toEqual([localFixture.users.find((user) => user.nickname === "Owen")?.id])
    expect(
      localFixture.roles.find(
        (role) => role.id === defaultUiResourceManagerRole.id,
      )?.userIds,
    ).toEqual([localFixture.users.find((user) => user.nickname === "Owen")?.id])
    const generalUser = localFixture.users.find(
      (user) => user.nickname === "Daniel",
    )
    const organizationLeader = localFixture.users.find(
      (user) => user.nickname === "Emma",
    )
    if (!generalUser || !organizationLeader) {
      throw new Error("Role fixture users are missing")
    }
    expect(
      resolveBackofficeAccess(localFixture, generalUser.id).menuIds,
    ).toEqual([
      "home",
      "users",
      "organizations",
      "applications",
      "approvalDocuments",
      "services",
      "serviceEndpoints",
      "namespaces",
      "apiKeys",
    ])
    expect(
      resolveBackofficeAccess(localFixture, organizationLeader.id),
    ).toEqual({
      roleIds: [defaultGeneralUserRole.id, defaultServiceOperatorRole.id],
      menuIds: [
        "home",
        "users",
        "organizations",
        "applications",
        "approvalDocuments",
        "services",
        "serviceEndpoints",
        "namespaces",
        "apiKeys",
      ],
    })
  })

  it("bundles system UI access by role instead of creating menu policies", () => {
    expect(
      initialBackofficeState.accessPolicies.map((policy) => policy.name),
    ).toEqual([
      "Access Governance 시스템 관리자 UI 접근",
      "Access Governance 일반 사용자 UI 접근",
      "Access Governance IAM 운영자 UI 접근",
      "Access Governance 정책 운영자 UI 접근",
      "Access Governance UI 리소스 관리자 UI 접근",
      "Access Governance 서비스 운영자 UI 접근",
    ])
    expect(
      initialBackofficeState.accessPolicies.some((policy) =>
        policy.name.includes("메뉴 접근"),
      ),
    ).toBe(false)
    expect(initialBackofficeState.accessPolicyAssignments).toHaveLength(6)

    const administratorPolicy = initialBackofficeState.accessPolicies.find(
      (policy) => policy.name === "Access Governance 시스템 관리자 UI 접근",
    )
    expect(
      administratorPolicy?.resources.filter(
        (resource) => resource.type === "ui-resource",
      ),
    ).toHaveLength(initialBackofficeState.uiResources.length)

    const generalUserPolicy = initialBackofficeState.accessPolicies.find(
      (policy) => policy.name === "Access Governance 일반 사용자 UI 접근",
    )
    const generalUserResourceIds = new Set(
      generalUserPolicy?.resources.flatMap((resource) =>
        resource.type === "ui-resource" ? [resource.id] : [],
      ),
    )
    for (const resourceKey of [
      uiResourceKeys.users.key,
      uiResourceKeys.users.list.key,
      uiResourceKeys.users.detail.key,
      uiResourceKeys.organizations.key,
      uiResourceKeys.organizations.list.key,
      uiResourceKeys.organizations.detail.key,
      uiResourceKeys.namespaces.key,
      uiResourceKeys.namespaces.list.key,
      uiResourceKeys.namespaces.detail.key,
    ]) {
      const resource = initialBackofficeState.uiResources.find(
        (candidate) => candidate.key === resourceKey,
      )
      expect(resource && generalUserResourceIds.has(resource.id)).toBe(true)
    }
    expect(
      initialBackofficeState.uiResources
        .filter(
          (resource) =>
            resource.type === "action" &&
            (resource.key.startsWith(`${uiResourceKeys.users.key}:`) ||
              resource.key.startsWith(`${uiResourceKeys.organizations.key}:`)),
        )
        .every((resource) => !generalUserResourceIds.has(resource.id)),
    ).toBe(true)
    expect(
      initialBackofficeState.uiResources
        .filter((resource) => resource.key === "services:list")
        .every((resource) => generalUserResourceIds.has(resource.id)),
    ).toBe(true)

    const iamOperatorPolicy = initialBackofficeState.accessPolicies.find(
      (policy) => policy.name === "Access Governance IAM 운영자 UI 접근",
    )
    const iamOperatorResourceIds = new Set(
      iamOperatorPolicy?.resources.flatMap((resource) =>
        resource.type === "ui-resource" ? [resource.id] : [],
      ),
    )
    expect(
      initialBackofficeState.uiResources
        .filter((resource) =>
          ["users", "organizations", "roles"].some(
            (menuId) =>
              resource.key === menuId || resource.key.startsWith(`${menuId}:`),
          ),
        )
        .filter(
          (resource) =>
            resource.key !==
            uiResourceKeys.users.detail.actions.changeEmploymentStatus,
        )
        .every((resource) => iamOperatorResourceIds.has(resource.id)),
    ).toBe(true)
  })

  it("assigns one dedicated leader to every organization and an employed member to every team", () => {
    const leaderIds = localFixture.organizations.map(
      (organization) => organization.leaderUserId,
    )

    expect(new Set(leaderIds).size).toBe(localFixture.organizations.length)

    for (const organization of localFixture.organizations) {
      const leader = localFixture.users.find(
        (user) => user.id === organization.leaderUserId,
      )

      expect(leader?.employmentStatus).toBe("employed")
      expect(leader?.organizationIds).toEqual([organization.id])
      const hasChildOrganization = localFixture.organizations.some(
        (candidate) => candidate.parentId === organization.id,
      )
      if (!hasChildOrganization) {
        expect(
          localFixture.users.some(
            (user) =>
              user.id !== organization.leaderUserId &&
              user.employmentStatus === "employed" &&
              user.organizationIds.includes(organization.id),
          ),
        ).toBe(true)
      }
    }

    expect(
      localFixture.roles.find(
        (role) => role.id === defaultServiceOperatorRole.id,
      )?.userIds,
    ).toEqual(leaderIds)
  })

  it("keeps every fixture relationship resolvable", () => {
    const userIds = new Set(localFixture.users.map((item) => item.id))
    const organizationIds = new Set(
      localFixture.organizations.map((item) => item.id),
    )
    const roleIds = new Set(localFixture.roles.map((item) => item.id))
    const approvalLineIds = new Set(
      localFixture.approvalLines.map((item) => item.id),
    )
    const approvalDocumentIds = new Set(
      localFixture.approvalDocuments.map((item) => item.id),
    )
    const serviceIds = new Set(localFixture.services.map((item) => item.id))
    const endpointIds = new Set(
      localFixture.serviceEndpoints.map((item) => item.id),
    )
    const uiResourceIds = new Set(
      localFixture.uiResources.map((item) => item.id),
    )
    const accessPolicyIds = new Set(
      localFixture.accessPolicies.map((item) => item.id),
    )

    expect(
      localFixture.organizations.every(
        (item) =>
          userIds.has(item.leaderUserId) &&
          (!item.parentId || organizationIds.has(item.parentId)),
      ),
    ).toBe(true)
    expect(
      localFixture.users.every((item) =>
        item.organizationIds.every((id) => organizationIds.has(id)),
      ),
    ).toBe(true)
    expect(
      localFixture.roles.every(
        (item) =>
          item.userIds.every((id) => userIds.has(id)) &&
          item.organizationIds.every((id) => organizationIds.has(id)),
      ),
    ).toBe(true)
    expect(
      localFixture.namespaces.every(
        (namespace) =>
          roleIds.has(namespace.managerRoleId) &&
          accessPolicyIds.has(namespace.managerAccessPolicyId) &&
          localFixture.accessPolicyAssignments.some(
            (assignment) =>
              assignment.accessPolicyId === namespace.managerAccessPolicyId &&
              assignment.targetType === "role" &&
              assignment.targetId === namespace.managerRoleId,
          ),
      ),
    ).toBe(true)
    expect(
      localFixture.approvalLines.every((item) =>
        item.steps.every((step) => {
          if (step.assigneeMode === "fixed-user") {
            return localFixture.users.some(
              (user) =>
                user.id === step.userId && user.employmentStatus === "employed",
            )
          }
          if (step.assigneeMode === "fixed-organization") {
            return organizationIds.has(step.organizationId)
          }
          return true
        }),
      ),
    ).toBe(true)
    expect(
      localFixture.accessPolicies.every(
        (policy) =>
          localFixture.approvalLines.filter(
            (line) =>
              line.status === "active" &&
              line.category === "permission" &&
              line.type === policy.type,
          ).length === 1 &&
          policy.resources.length > 0 &&
          new Set(
            policy.resources.map(
              (resource) => `${resource.type}:${resource.id}`,
            ),
          ).size === policy.resources.length &&
          policy.resources.every((resource) => {
            if (resource.type === "ui-resource") {
              return uiResourceIds.has(resource.id)
            }
            const endpoint = localFixture.serviceEndpoints.find(
              (item) => item.id === resource.id,
            )
            return Boolean(
              endpointIds.has(resource.id) &&
              endpoint &&
              serviceIds.has(endpoint.serviceId),
            )
          }),
      ),
    ).toBe(true)
    expect(
      localFixture.accessPolicyAssignments.every((assignment) => {
        if (!accessPolicyIds.has(assignment.accessPolicyId)) return false
        if (assignment.targetType === "user") {
          return userIds.has(assignment.targetId)
        }
        if (assignment.targetType === "organization") {
          return organizationIds.has(assignment.targetId)
        }
        if (assignment.targetType === "role") {
          return roleIds.has(assignment.targetId)
        }
        return localFixture.applications.some(
          (application) => application.id === assignment.targetId,
        )
      }),
    ).toBe(true)
    expect(
      localFixture.approvalDocuments.every((item) => {
        const line = localFixture.approvalLines.find(
          (candidate) => candidate.id === item.approvalLineId,
        )
        const requester = localFixture.users.find(
          (candidate) => candidate.id === item.requesterId,
        )
        return (
          organizationIds.has(item.organizationId) &&
          userIds.has(item.requesterId) &&
          approvalLineIds.has(item.approvalLineId) &&
          line?.type === item.type &&
          requester?.employmentStatus === "employed" &&
          requester.organizationIds.includes(item.organizationId) &&
          (item.documentKind !== "api-key-issuance" ||
            serviceIds.has(item.serviceId)) &&
          (item.documentKind !== "general" ||
            item.type !== "access-grant" ||
            accessPolicyIds.has(item.accessPolicyId)) &&
          item.approvalSteps.every((step) => {
            return step.assigneeType === "user"
              ? localFixture.users.some(
                  (user) =>
                    user.id === step.assigneeId &&
                    user.employmentStatus === "employed",
                )
              : organizationIds.has(step.assigneeId)
          })
        )
      }),
    ).toBe(true)
    expect(
      localFixture.notifications.every(
        (notification) =>
          userIds.has(notification.userId) &&
          (notification.targetType === "approval-document"
            ? approvalDocumentIds.has(notification.targetId)
            : notification.targetType === "access-policy"
              ? accessPolicyIds.has(notification.targetId)
              : serviceIds.has(notification.targetId)),
      ),
    ).toBe(true)
    expect(
      localFixture.services.every((item) => {
        const templates = [
          [item.credentialTemplateIds.issuance, "api-key"],
          [item.credentialTemplateIds.replacement, "api-key-replace"],
          [item.credentialTemplateIds.disposal, "api-key-dispose"],
        ] as const
        return (
          organizationIds.has(item.ownerOrganizationId) &&
          templates.every(([id, type]) =>
            localFixture.approvalLines.some(
              (template) =>
                template.id === id &&
                template.category === "credential" &&
                template.type === type,
            ),
          )
        )
      }),
    ).toBe(true)
    expect(
      localFixture.serviceEndpoints.every((item) => {
        const service = localFixture.services.find(
          (candidate) => candidate.id === item.serviceId,
        )
        return serviceIds.has(item.serviceId) && service?.type === "internal"
      }),
    ).toBe(true)
    expect(
      localFixture.serviceEndpointFields.every((field) =>
        endpointIds.has(field.endpointId),
      ),
    ).toBe(true)
    expect(
      new Set(
        localFixture.serviceEndpointFields.map(
          (field) =>
            `${field.endpointId}\u0000${field.location}\u0000${field.fieldPath}`,
        ),
      ).size,
    ).toBe(localFixture.serviceEndpointFields.length)
    expect(
      localFixture.apiKeys.every(
        (item) =>
          serviceIds.has(item.serviceId) &&
          approvalDocumentIds.has(item.approvalDocumentId) &&
          (item.registeredByUserId === null ||
            userIds.has(item.registeredByUserId)),
      ),
    ).toBe(true)
  })
})
