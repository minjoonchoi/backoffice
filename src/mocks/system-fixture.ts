import {
  getMenuUiResourceKeys,
  uiResourceKeys,
  uiResourceManifest,
  type MenuKey,
} from "@/config/menu-registry"
import type {
  AccessPolicy,
  AccessPolicyAssignment,
  AccessPolicyAssignmentTarget,
  AccessPolicyResource,
} from "@/features/access-policies/model"
import type { BackofficeState } from "@/application/state/model"
import type { Group, Role } from "@/features/iam/model"
import type { UiNamespace, UiResource } from "@/features/ui-resources/model"
import { uiResourceManagerUiResourceKeys } from "@/config/system-ui-access"
import { backofficeSystemReferencesSchema } from "@/domain/system-references"

const localSystemReferences = backofficeSystemReferencesSchema.parse({
  roleIds: {
    administrator: "00000000-0000-4000-8000-000000000001",
    policyOperator: "00000000-0000-4000-8000-000000000004",
    iamOperator: "00000000-0000-4000-8000-000000000011",
    generalUser: "00000000-0000-4000-8000-000000000008",
    uiResourceManager: "00000000-0000-4000-8000-000000000010",
  },
  groupIds: {
    organizationLeader: "00000000-0000-4000-8000-000000000002",
  },
  uiNamespaceIds: {
    backoffice: "00000000-0000-4000-8000-000000000009",
  },
  serviceEndpointIds: {
    importUiResources: "70000000-0000-4000-8000-000000000004",
  },
})

export const defaultBackofficeAdminRole: Role = {
  id: localSystemReferences.roleIds.administrator,
  name: "Backoffice 시스템 관리자",
  description:
    "Backoffice 네임스페이스의 모든 UI 리소스와 관리 기능에 접근하는 기본 역할입니다.",
  userIds: [],
  organizationIds: [],
  createdAt: "2026-08-08T00:00:00.000Z",
}
export const defaultPolicyOperatorRole: Role = {
  id: localSystemReferences.roleIds.policyOperator,
  name: "Backoffice 정책 운영자",
  description:
    "Backoffice에서 정책을 생성·수정·삭제하는 시스템 기본 역할입니다.",
  userIds: [],
  organizationIds: [],
  createdAt: "2026-08-08T00:00:00.000Z",
}
export const defaultIamOperatorRole: Role = {
  id: localSystemReferences.roleIds.iamOperator,
  name: "Backoffice IAM 운영자",
  description:
    "Backoffice의 사용자, 조직, 역할과 그룹을 조회하고 관리하는 시스템 기본 역할입니다.",
  userIds: [],
  organizationIds: [],
  createdAt: "2026-08-12T00:00:00.000Z",
}
export const defaultGeneralUserRole: Role = {
  id: localSystemReferences.roleIds.generalUser,
  name: "Backoffice 일반 사용자",
  description:
    "Backoffice의 카탈로그, 접근 정책과 자격증명을 조회하는 기본 역할입니다.",
  userIds: [],
  organizationIds: [],
  createdAt: "2026-08-08T00:00:00.000Z",
}
export const defaultUiResourceManagerRole: Role = {
  id: localSystemReferences.roleIds.uiResourceManager,
  name: "Backoffice UI 리소스 관리자",
  description:
    "정책으로 허용된 네임스페이스의 UI 리소스를 동기화하고 정리하는 시스템 기본 역할입니다.",
  userIds: [],
  organizationIds: [],
  createdAt: "2026-08-11T00:00:00.000Z",
}

export const organizationLeaderGroup: Group = {
  id: localSystemReferences.groupIds.organizationLeader,
  name: "조직장 그룹",
  description:
    "조직 정보에 따라 조직장을 자동으로 동기화하는 시스템 그룹입니다.",
  userIds: [],
  createdAt: "2026-08-08T00:00:00.000Z",
}
const backofficeAdministratorAccessPolicyId =
  "45000000-0000-4000-8000-000000000101"
export const defaultUiNamespace: UiNamespace = {
  id: localSystemReferences.uiNamespaceIds.backoffice,
  key: "backoffice",
  name: "Backoffice",
  description: "Backoffice 애플리케이션의 UI 리소스 네임스페이스입니다.",
  administratorRoleId: defaultBackofficeAdminRole.id,
  administratorAccessPolicyId: backofficeAdministratorAccessPolicyId,
  status: "active",
  lastSyncedAt: "2026-08-11T00:00:00.000Z",
  createdAt: "2026-08-11T00:00:00.000Z",
}
const policyOperatorUiResourceKeys = [
  uiResourceKeys.approvalDocuments.list.actions.createPolicy,
  uiResourceKeys.approvalDocuments.detail.actions.updatePolicy,
  uiResourceKeys.approvalDocuments.detail.actions.deletePolicy,
]
const systemUiAccessCreatedAt = "2026-08-11T00:00:00.000Z"

export const initialUiResources: UiResource[] =
  uiResourceManifest.resources.map((resource, index) => ({
    ...resource,
    id: `90000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    namespaceId: defaultUiNamespace.id,
    status: "active",
    orphanedAt: null,
    createdAt: systemUiAccessCreatedAt,
  }))

function uiResourceReference(key: string): AccessPolicyResource {
  const resource = initialUiResources.find((candidate) => candidate.key === key)
  if (!resource) throw new Error(`Initial UI resource not found: ${key}`)
  return { type: "ui-resource", id: resource.id }
}
function uiResourceReferences(keys: readonly string[]) {
  return [...new Set(keys)].map(uiResourceReference)
}

const generalUserMenuIds: MenuKey[] = [
  uiResourceKeys.home.key,
  uiResourceKeys.approvalDocuments.key,
  uiResourceKeys.services.key,
  uiResourceKeys.serviceEndpoints.key,
  uiResourceKeys.apiKeys.key,
]

const iamMenuIds: MenuKey[] = [
  uiResourceKeys.users.key,
  uiResourceKeys.organizations.key,
  uiResourceKeys.roles.key,
  uiResourceKeys.groups.key,
]

const iamOperatorUiResourceKeys = [
  ...getMenuUiResourceKeys(iamMenuIds),
  ...initialUiResources
    .filter(
      (resource) =>
        resource.type === "action" &&
        iamMenuIds.some((menuId) => resource.key.startsWith(`${menuId}:`)),
    )
    .map((resource) => resource.key),
]

function createUiAccessPolicy(
  id: string,
  name: string,
  description: string,
  resourceKeys: readonly string[],
  assignments: readonly {
    targetType: AccessPolicyAssignmentTarget
    targetId: string
  }[],
  additionalResources: readonly AccessPolicyResource[] = [],
) {
  return {
    policy: {
      id,
      name,
      description,
      type: "access-grant",
      effect: "allow",
      resources: [
        ...uiResourceReferences(resourceKeys),
        ...additionalResources,
      ],
      status: "active",
      createdAt: systemUiAccessCreatedAt,
    } satisfies AccessPolicy,
    assignments,
  }
}

const roleUiAccessPolicies = [
  createUiAccessPolicy(
    backofficeAdministratorAccessPolicyId,
    "Backoffice 시스템 관리자 UI 접근",
    "Backoffice 시스템 관리자 역할에 Backoffice 네임스페이스의 모든 UI 리소스를 허용합니다.",
    initialUiResources.map((resource) => resource.key),
    [{ targetType: "role", targetId: defaultBackofficeAdminRole.id }],
    [
      { type: "ui-namespace", id: defaultUiNamespace.id },
      {
        type: "endpoint",
        id: localSystemReferences.serviceEndpointIds.importUiResources,
      },
    ],
  ),
  createUiAccessPolicy(
    "45000000-0000-4000-8000-000000000106",
    "Backoffice 일반 사용자 UI 접근",
    "Backoffice 일반 사용자 역할에 정책, 자격증명과 카탈로그의 기본 조회 화면을 허용합니다.",
    [
      ...getMenuUiResourceKeys(generalUserMenuIds),
      uiResourceKeys.home.overview.actions.markNotificationRead,
    ],
    [{ targetType: "role", targetId: defaultGeneralUserRole.id }],
  ),
  createUiAccessPolicy(
    "45000000-0000-4000-8000-000000000107",
    "Backoffice IAM 운영자 UI 접근",
    "Backoffice IAM 운영자 역할에 사용자, 조직, 역할과 그룹의 조회·관리 기능을 허용합니다.",
    iamOperatorUiResourceKeys,
    [{ targetType: "role", targetId: defaultIamOperatorRole.id }],
  ),
  createUiAccessPolicy(
    "45000000-0000-4000-8000-000000000103",
    "Backoffice 정책 운영자 UI 접근",
    "Backoffice 정책 운영자 역할에 정책 생성·수정·삭제 기능을 추가로 허용합니다.",
    [
      ...getMenuUiResourceKeys([uiResourceKeys.approvalDocuments.key]),
      ...policyOperatorUiResourceKeys,
    ],
    [{ targetType: "role", targetId: defaultPolicyOperatorRole.id }],
  ),
  createUiAccessPolicy(
    "45000000-0000-4000-8000-000000000104",
    "Backoffice UI 리소스 관리자 UI 접근",
    "Backoffice UI 리소스 관리자 역할에 리소스 조회·동기화·상태 변경·고아 리소스 정리를 허용합니다.",
    uiResourceManagerUiResourceKeys,
    [{ targetType: "role", targetId: defaultUiResourceManagerRole.id }],
    [
      { type: "ui-namespace", id: defaultUiNamespace.id },
      {
        type: "endpoint",
        id: localSystemReferences.serviceEndpointIds.importUiResources,
      },
    ],
  ),
  createUiAccessPolicy(
    "45000000-0000-4000-8000-000000000105",
    "Backoffice 조직장 서비스·엔드포인트 관리 UI 접근",
    "조직장 그룹에 소유 조직의 서비스와 엔드포인트 관리 및 자격증명 등록 기능을 허용합니다.",
    [
      ...getMenuUiResourceKeys([
        uiResourceKeys.services.key,
        uiResourceKeys.serviceEndpoints.key,
        uiResourceKeys.apiKeys.key,
      ]),
      ...initialUiResources
        .filter(
          (resource) =>
            resource.type === "action" &&
            (resource.key.startsWith(`${uiResourceKeys.services.key}:`) ||
              resource.key.startsWith(
                `${uiResourceKeys.serviceEndpoints.key}:`,
              )),
        )
        .map((resource) => resource.key),
      uiResourceKeys.apiKeys.list.actions.registerCredential,
    ],
    [{ targetType: "group", targetId: organizationLeaderGroup.id }],
  ),
]

export const systemUiAccessPolicies: AccessPolicy[] = [
  ...roleUiAccessPolicies.map(({ policy }) => policy),
]
const systemUiPolicyAssignments = [
  ...roleUiAccessPolicies.flatMap(({ policy, assignments }) =>
    assignments.map((assignment) => ({
      accessPolicyId: policy.id,
      ...assignment,
    })),
  ),
]
export const systemUiAccessPolicyAssignments: AccessPolicyAssignment[] =
  systemUiPolicyAssignments.map((assignment, index) => ({
    id: `46000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    ...assignment,
    createdAt: systemUiAccessCreatedAt,
  }))

export const initialBackofficeState: BackofficeState = {
  systemReferences: localSystemReferences,
  organizations: [],
  users: [],
  roles: [
    defaultBackofficeAdminRole,
    defaultPolicyOperatorRole,
    defaultIamOperatorRole,
    defaultGeneralUserRole,
    defaultUiResourceManagerRole,
  ],
  groups: [organizationLeaderGroup],
  approvalLines: [],
  accessPolicies: systemUiAccessPolicies,
  accessPolicyAssignments: systemUiAccessPolicyAssignments,
  approvalDocuments: [],
  notifications: [],
  services: [],
  serviceEndpoints: [],
  serviceEndpointFields: [],
  apiKeys: [],
  uiNamespaces: [defaultUiNamespace],
  uiResources: initialUiResources,
}
