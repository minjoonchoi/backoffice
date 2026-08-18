import { describe, expect, it } from "vitest"

import {
  getMenuViewResourceKey,
  menuDefinitions,
  menuViewDefinitions,
  uiResourceKeys,
  uiResourceManifest,
} from "@/config/menu-registry"
import {
  accessPolicyAssignmentTargetSchema,
  accessPolicyInputSchema,
} from "@/features/access-policies/model"
import { approvalLineInputSchema } from "@/features/request-templates/model"
import {
  organizationInputSchema,
  roleInputSchema,
  userInputSchema,
} from "@/features/iam/model"
import {
  serviceEndpointInputSchema,
  serviceInputSchema,
} from "@/features/service-catalog/model"

const organizationId = "122d35bc-9978-4d60-8894-8d9084d37902"
const userId = "3befcf71-cfa3-48e1-8ca6-9d05b3c8952f"
const credentialTemplateIds = {
  issuance: userId,
  replacement: userId,
  disposal: userId,
}

describe("backoffice input schemas", () => {
  it("registers every navigable UI menu once with a unique path", () => {
    expect(new Set(menuDefinitions.map((menu) => menu.id)).size).toBe(
      menuDefinitions.length,
    )
    expect(new Set(menuDefinitions.map((menu) => menu.href)).size).toBe(
      menuDefinitions.length,
    )
    expect(menuDefinitions.map((menu) => menu.href)).not.toContain("/menus")
    expect(
      menuDefinitions.find((menu) => menu.id === "serviceEndpoints")?.href,
    ).toBe("/service-endpoints")
    expect(menuDefinitions.find((menu) => menu.id === "apiKeys")?.href).toBe(
      "/credentials",
    )
    expect(menuDefinitions.find((menu) => menu.id === "apiKeys")?.section).toBe(
      "common",
    )
    expect(
      menuDefinitions.find((menu) => menu.id === "approvalLines")?.section,
    ).toBe("systemManagement")
    expect(
      menuDefinitions.find((menu) => menu.id === "approvalDocuments")?.section,
    ).toBe("common")
    expect(
      menuDefinitions
        .filter((menu) => menu.section === "directory")
        .map((menu) => menu.id),
    ).toEqual(["users", "organizations", "roles", "applications"])
    expect(
      menuDefinitions
        .filter((menu) => menu.section === "serviceCatalog")
        .map((menu) => menu.id),
    ).toEqual(["services", "serviceEndpoints"])
    expect(
      menuDefinitions
        .filter((menu) => menu.section === "uiCatalog")
        .map((menu) => menu.id),
    ).toEqual(["namespaces", "uiResources"])
    expect(
      menuDefinitions
        .filter((menu) => menu.section === "systemManagement")
        .map((menu) => menu.id),
    ).toEqual(["requests", "approvalLines", "auditLogs"])
  })

  it("registers stable feature keys against code-owned menus", () => {
    const actionResources = uiResourceManifest.resources.filter(
      (resource) => resource.type === "action",
    )
    expect(new Set(actionResources.map((resource) => resource.key)).size).toBe(
      actionResources.length,
    )
    expect(
      menuDefinitions.every((menu) => /^[a-z][a-zA-Z0-9]*$/.test(menu.id)),
    ).toBe(true)
    expect(uiResourceKeys.services.detail.actions.updateService).toBe(
      "services:detail:updateService",
    )
  })

  it("registers page views between menus and their actions", () => {
    const resourcesByKey = new Map(
      uiResourceManifest.resources.map((resource) => [resource.key, resource]),
    )

    for (const menu of menuDefinitions) {
      expect(
        menuViewDefinitions.some(
          (view) => view.menuId === menu.id && view.view === menu.defaultView,
        ),
      ).toBe(true)
    }
    for (const view of menuViewDefinitions) {
      const key = getMenuViewResourceKey(view.menuId, view.view)
      expect(resourcesByKey.get(key)).toMatchObject({
        type: "view",
        parentKey: view.menuId,
      })
    }
    for (const resource of uiResourceManifest.resources.filter(
      (item) => item.type === "action",
    )) {
      expect(resourcesByKey.get(resource.parentKey ?? "")).toMatchObject({
        type: "view",
      })
    }
  })

  it("models nickname, email, employment status, and multiple organizations", () => {
    const parsed = userInputSchema.safeParse({
      nickname: "minjoon",
      email: "minjoon@example.com",
      employmentStatus: "employed",
      organizationIds: [organizationId],
      employeeNumber: "E-100",
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data).not.toHaveProperty("employeeNumber")
    expect(
      userInputSchema.safeParse({
        nickname: "minjoon",
        email: "minjoon@example.com",
        employmentStatus: "employed",
        organizationIds: [organizationId, organizationId],
      }).success,
    ).toBe(false)
    expect(
      userInputSchema.safeParse({
        nickname: "minjoon",
        email: "minjoon@example.com",
        employmentStatus: "employed",
        organizationIds: [],
      }).success,
    ).toBe(false)
    expect(
      userInputSchema.safeParse({
        nickname: "minjoon",
        email: "minjoon@example.com",
        employmentStatus: "resigned",
        organizationIds: [],
      }).success,
    ).toBe(true)
  })

  it("requires an organization leader and accepts an optional parent", () => {
    expect(
      organizationInputSchema.safeParse({
        name: "플랫폼 운영",
        leaderUserId: userId,
        parentId: organizationId,
      }).success,
    ).toBe(true)
    expect(
      organizationInputSchema.safeParse({ name: "플랫폼 운영" }).success,
    ).toBe(false)
  })

  it("validates role names and descriptions", () => {
    expect(
      roleInputSchema.safeParse({
        name: "서비스 관리자",
        description: "서비스 설정과 엔드포인트를 관리합니다.",
      }).success,
    ).toBe(true)
    expect(
      roleInputSchema.safeParse({ name: "A", description: "관리" }).success,
    ).toBe(false)
  })

  it("requires a unique resource set when creating an access policy", () => {
    expect(
      accessPolicyInputSchema.safeParse({
        name: "서비스 상태 조회 허용",
        description: "서비스 상태 조회에 필요한 엔드포인트를 허용합니다.",
        type: "access-grant",
        effect: "allow",
        resources: [{ type: "endpoint", id: organizationId }],
      }).success,
    ).toBe(true)
    expect(
      accessPolicyInputSchema.safeParse({
        name: "서비스 상태 조회 허용",
        description: "서비스 상태 조회에 필요한 엔드포인트를 허용합니다.",
        type: "access-grant",
        effect: "allow",
        resources: [
          { type: "endpoint", id: organizationId },
          { type: "endpoint", id: organizationId },
        ],
      }).success,
    ).toBe(false)
    expect(
      accessPolicyInputSchema.safeParse({
        name: "서비스 상태 조회 허용",
        description: "서비스 상태 조회에 필요한 엔드포인트를 허용합니다.",
        type: "access-grant",
        effect: "allow",
        resources: [],
      }).success,
    ).toBe(false)
    expect(
      accessPolicyInputSchema.safeParse({
        name: "UI 리소스 동기화 허용",
        description: "UI 기능과 호출 API를 하나의 정책으로 묶습니다.",
        type: "access-grant",
        effect: "allow",
        resources: [
          { type: "ui-resource", id: organizationId },
          {
            type: "endpoint",
            id: "48ea165c-d115-46ce-8b22-3789e8ced78b",
          },
        ],
      }).success,
    ).toBe(true)
    expect(
      accessPolicyInputSchema.safeParse({
        name: "잘못된 네임스페이스 정책",
        description: "네임스페이스는 정책 리소스로 사용할 수 없습니다.",
        type: "access-grant",
        effect: "allow",
        resources: [{ type: "namespace", id: organizationId }],
      }).success,
    ).toBe(false)
    expect(accessPolicyAssignmentTargetSchema.safeParse("group").success).toBe(
      false,
    )
  })

  it("accepts fixed, dynamic, and parallel request-template steps", () => {
    expect(
      approvalLineInputSchema.safeParse({
        name: "권한 부여 결재 템플릿",
        category: "permission",
        type: "access-grant",
        approvalExecution: { type: "internal" },
        steps: [
          { kind: "request", assigneeMode: "requester", stage: 1 },
          {
            kind: "approval",
            assigneeMode: "request-organization-leader",
            stage: 2,
          },
          {
            kind: "agreement",
            assigneeMode: "fixed-user",
            userId,
            stage: 3,
          },
          {
            kind: "agreement",
            assigneeMode: "document-select",
            stage: 3,
          },
        ],
        fields: [],
      }).success,
    ).toBe(true)
    expect(
      approvalLineInputSchema.safeParse({
        name: "잘못된 접근 정책 템플릿",
        category: "permission",
        type: "access-grant",
        approvalExecution: { type: "internal" },
        steps: [
          {
            kind: "agreement",
            assigneeMode: "service-owner-organization",
            stage: 1,
          },
        ],
        fields: [],
      }).success,
    ).toBe(false)
  })

  it("validates request-template categories and unique system bindings", () => {
    const template = {
      name: "API Key 발급 결재 템플릿",
      category: "credential",
      type: "api-key",
      approvalExecution: { type: "internal" },
      steps: [{ kind: "request", assigneeMode: "requester", stage: 1 }],
      fields: [
        {
          key: "service",
          label: "대상 서비스",
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
          label: "Credential 이름",
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
    }

    expect(approvalLineInputSchema.safeParse(template).success).toBe(true)
    expect(
      approvalLineInputSchema.safeParse({
        ...template,
        approvalExecution: {
          type: "groo",
          draftDocumentId: "GROO-CREDENTIAL-ISSUANCE-V1",
        },
        steps: [],
      }).success,
    ).toBe(true)
    expect(
      approvalLineInputSchema.safeParse({
        ...template,
        approvalExecution: { type: "groo", draftDocumentId: "" },
        steps: [],
      }).success,
    ).toBe(false)
    expect(
      approvalLineInputSchema.safeParse({
        ...template,
        approvalExecution: {
          type: "groo",
          draftDocumentId: "GROO-CREDENTIAL-ISSUANCE-V1",
        },
      }).success,
    ).toBe(false)
    expect(
      approvalLineInputSchema.safeParse({
        ...template,
        fields: [
          ...template.fields,
          { ...template.fields[0], key: "duplicate-service" },
        ],
      }).success,
    ).toBe(false)
    expect(
      approvalLineInputSchema.safeParse({
        ...template,
        type: "access-grant",
      }).success,
    ).toBe(false)
  })

  it("rejects incomplete or non-contiguous template stages and absolute endpoint URLs", () => {
    expect(
      approvalLineInputSchema.safeParse({
        name: "잘못된 결재 템플릿",
        category: "permission",
        type: "access-grant",
        approvalExecution: { type: "internal" },
        steps: [
          { kind: "request", assigneeMode: "requester", stage: 1 },
          { kind: "approval", assigneeMode: "fixed-user", stage: 3 },
        ],
        fields: [],
      }).success,
    ).toBe(false)
    expect(
      serviceEndpointInputSchema.safeParse({
        serviceId: organizationId,
        name: "이벤트 API",
        method: "GET",
        path: "https://example.com/events",
        fields: [],
      }).success,
    ).toBe(false)
  })

  it("models endpoint contract fields as uniquely addressable entities", () => {
    const parsed = serviceEndpointInputSchema.safeParse({
      serviceId: organizationId,
      name: "이벤트 API",
      method: "POST",
      path: "/events",
      fields: [
        {
          location: "query",
          fieldPath: "$.eventType",
          valueType: "string",
          required: true,
          description: "이벤트 유형",
        },
        {
          location: "request-body",
          fieldPath: "$.payload.userId",
          valueType: "string",
          required: true,
          description: "사용자 ID",
        },
        {
          location: "response-body",
          fieldPath: "$.accepted",
          valueType: "boolean",
          required: true,
          description: "접수 여부",
        },
      ],
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data).not.toHaveProperty("environment")
    expect(parsed.data.fields[1]?.fieldPath).toBe("$.payload.userId")
    expect(
      serviceEndpointInputSchema.safeParse({
        ...parsed.data,
        fields: [
          {
            location: "request-body",
            fieldPath: "/payload/userId",
            valueType: "string",
            required: true,
            description: "JSONPath가 아닌 경로",
          },
        ],
      }).success,
    ).toBe(false)
    expect(
      serviceEndpointInputSchema.safeParse({
        ...parsed.data,
        fields: [parsed.data.fields[0], parsed.data.fields[0]],
      }).success,
    ).toBe(false)
  })

  it("stores the host on services and only paths on endpoints", () => {
    expect(
      serviceInputSchema.safeParse({
        name: "파트너 API",
        serviceKey: "partner-api",
        host: "https://partner.example.com",
        type: "internal",
        ownerOrganizationId: organizationId,
        credentialTemplateIds,
      }).success,
    ).toBe(true)
    expect(
      serviceInputSchema.safeParse({
        name: "파트너 API",
        serviceKey: "partner-api",
        host: "https://partner.example.com/v1",
        type: "internal",
        ownerOrganizationId: organizationId,
        credentialTemplateIds,
      }).success,
    ).toBe(false)
    expect(
      serviceInputSchema.safeParse({
        name: "외부 협업 도구",
        serviceKey: "collaboration-tool",
        host: "https://collaboration.example.com",
        type: "external",
        ownerOrganizationId: organizationId,
        credentialTemplateIds,
      }).success,
    ).toBe(true)
    expect(
      serviceInputSchema.safeParse({
        name: "과거 SaaS 유형",
        serviceKey: "legacy-saas",
        host: "https://legacy.example.com",
        type: "saas",
        ownerOrganizationId: organizationId,
        credentialTemplateIds,
      }).success,
    ).toBe(false)
    for (const code of [
      "PARTNER-API",
      "partner_api",
      "partner-1",
      "-partner",
      "partner-",
      "partner--api",
    ]) {
      expect(
        serviceInputSchema.safeParse({
          name: "파트너 API",
          code,
          host: "https://partner.example.com",
          type: "internal",
          ownerOrganizationId: organizationId,
          credentialTemplateIds,
        }).success,
      ).toBe(false)
    }
    expect(
      serviceEndpointInputSchema.safeParse({
        serviceId: organizationId,
        name: "파트너 이벤트",
        method: "POST",
        path: "//external.example.com/events",
        fields: [],
      }).success,
    ).toBe(false)
  })
})
