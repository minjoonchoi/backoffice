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
import { accessPolicyManagementTypes } from "@/features/access-policies/model"
import {
  accessPolicyAssignmentTargets,
  accessPolicyEffects,
  accessPolicyResourceTypes,
  accessPolicyTypes,
} from "@/features/access-policies/model"
import type { BackofficeState } from "@/application/state/model"
import { applicationIdentity } from "@/config/application-identity"
import type { Role } from "@/features/iam/model"
import type { Namespace, UiResource } from "@/features/ui-resources/model"
import { uiResourceManagerUiResourceKeys } from "@/config/system-ui-access"
import { backofficeSystemReferencesSchema } from "@/domain/system-references"
import { entityStatuses } from "@/domain/common"
import { uiResourceTypeValues } from "@/features/ui-resources/ui-resource-manifest"

const localSystemReferences = backofficeSystemReferencesSchema.parse({
  roleIds: {
    administrator: "00000000-0000-4000-8000-000000000001",
    policyOperator: "00000000-0000-4000-8000-000000000004",
    iamOperator: "00000000-0000-4000-8000-000000000011",
    generalUser: "00000000-0000-4000-8000-000000000008",
    uiResourceManager: "00000000-0000-4000-8000-000000000010",
    serviceOperator: "00000000-0000-4000-8000-000000000002",
  },
  namespaceIds: {
    backoffice: "00000000-0000-4000-8000-000000000009",
  },
  serviceEndpointIds: {
    importUiResources: "70000000-0000-4000-8000-000000000004",
  },
})

export const defaultBackofficeAdminRole: Role = {
  id: localSystemReferences.roleIds.administrator,
  name: `${applicationIdentity.displayName} 시스템 관리자`,
  description: `${applicationIdentity.displayName} 네임스페이스의 모든 UI 리소스와 관리 기능에 접근하는 기본 역할입니다.`,
  userIds: [],
  organizationIds: [],
  createdAt: "2026-08-08T00:00:00.000Z",
}
export const defaultPolicyOperatorRole: Role = {
  id: localSystemReferences.roleIds.policyOperator,
  name: `${applicationIdentity.displayName} 정책 운영자`,
  description: `${applicationIdentity.displayName}에서 정책을 생성·수정·삭제하는 시스템 기본 역할입니다.`,
  userIds: [],
  organizationIds: [],
  createdAt: "2026-08-08T00:00:00.000Z",
}
export const defaultIamOperatorRole: Role = {
  id: localSystemReferences.roleIds.iamOperator,
  name: `${applicationIdentity.displayName} IAM 운영자`,
  description: `${applicationIdentity.displayName}의 사용자, 조직, 역할과 어플리케이션을 조회하고 관리하는 시스템 기본 역할입니다.`,
  userIds: [],
  organizationIds: [],
  createdAt: "2026-08-12T00:00:00.000Z",
}
export const defaultGeneralUserRole: Role = {
  id: localSystemReferences.roleIds.generalUser,
  name: `${applicationIdentity.displayName} 일반 사용자`,
  description: `사용자·조직 정보와 소속 조직 어플리케이션을 조회하고 ${applicationIdentity.displayName}의 서비스·엔드포인트·네임스페이스 카탈로그, 접근 정책과 자격증명을 사용하는 기본 역할입니다.`,
  userIds: [],
  organizationIds: [],
  createdAt: "2026-08-08T00:00:00.000Z",
}
export const defaultUiResourceManagerRole: Role = {
  id: localSystemReferences.roleIds.uiResourceManager,
  name: `${applicationIdentity.displayName} UI 리소스 관리자`,
  description:
    "관리 역할로 지정된 네임스페이스의 UI 리소스를 동기화하고 정리하는 시스템 기본 역할입니다.",
  userIds: [],
  organizationIds: [],
  createdAt: "2026-08-11T00:00:00.000Z",
}
export const defaultServiceOperatorRole: Role = {
  id: localSystemReferences.roleIds.serviceOperator,
  name: `${applicationIdentity.displayName} 서비스 운영자`,
  description:
    "조직 정보에 따라 현재 조직장에게 자동으로 부여되는 서비스 카탈로그 운영 역할입니다.",
  userIds: [],
  organizationIds: [],
  createdAt: "2026-08-08T00:00:00.000Z",
}
const backofficeAdministratorAccessPolicyId =
  "45000000-0000-4000-8000-000000000101"
const uiResourceManagerAccessPolicyId = "45000000-0000-4000-8000-000000000104"
export const defaultNamespace: Namespace = {
  id: localSystemReferences.namespaceIds.backoffice,
  key: applicationIdentity.namespaceKey,
  name: applicationIdentity.displayName,
  description: `${applicationIdentity.displayName} 애플리케이션의 UI 리소스 네임스페이스입니다.`,
  managerRoleId: defaultUiResourceManagerRole.id,
  managerAccessPolicyId: uiResourceManagerAccessPolicyId,
  status: entityStatuses.active,
  lastSyncedAt: "2026-08-11T00:00:00.000Z",
  createdAt: "2026-08-11T00:00:00.000Z",
}
const policyOperatorUiResourceKeys = [
  uiResourceKeys.approvalDocuments.list.actions.createPolicy,
  uiResourceKeys.approvalDocuments.list.actions.simulatePolicyAccess,
  uiResourceKeys.approvalDocuments.detail.actions.clonePolicy,
  uiResourceKeys.approvalDocuments.detail.actions.updatePolicy,
  uiResourceKeys.approvalDocuments.detail.actions.deletePolicy,
  uiResourceKeys.approvalDocuments.detail.actions.revokePolicyAssignment,
]
const systemUiAccessCreatedAt = "2026-08-11T00:00:00.000Z"

export const initialUiResources: UiResource[] =
  uiResourceManifest.resources.map((resource, index) => ({
    ...resource,
    id: `90000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    namespaceId: defaultNamespace.id,
    status: entityStatuses.active,
    orphanedAt: null,
    createdAt: systemUiAccessCreatedAt,
  }))

function uiResourceReference(key: string): AccessPolicyResource {
  const resource = initialUiResources.find((candidate) => candidate.key === key)
  if (!resource) throw new Error(`Initial UI resource not found: ${key}`)
  return { type: accessPolicyResourceTypes.uiResource, id: resource.id }
}
function uiResourceReferences(keys: readonly string[]) {
  return [...new Set(keys)].map(uiResourceReference)
}

const generalUserUiResourceKeys = [
  uiResourceKeys.home.key,
  uiResourceKeys.home.overview.key,
  uiResourceKeys.users.key,
  uiResourceKeys.users.list.key,
  uiResourceKeys.users.detail.key,
  uiResourceKeys.organizations.key,
  uiResourceKeys.organizations.list.key,
  uiResourceKeys.organizations.detail.key,
  uiResourceKeys.approvalDocuments.key,
  uiResourceKeys.approvalDocuments.list.key,
  uiResourceKeys.approvalDocuments.detail.key,
  uiResourceKeys.approvalDocuments.requestDetail.key,
  uiResourceKeys.approvalDocuments.request.key,
  uiResourceKeys.applications.key,
  uiResourceKeys.applications.list.key,
  uiResourceKeys.applications.create.key,
  uiResourceKeys.applications.update.key,
  uiResourceKeys.applications.detail.key,
  uiResourceKeys.applications.list.actions.createApplication,
  uiResourceKeys.applications.detail.actions.updateApplication,
  uiResourceKeys.applications.detail.actions.deleteApplication,
  uiResourceKeys.services.key,
  uiResourceKeys.services.list.key,
  uiResourceKeys.services.detail.key,
  uiResourceKeys.serviceEndpoints.key,
  uiResourceKeys.serviceEndpoints.list.key,
  uiResourceKeys.serviceEndpoints.detail.key,
  uiResourceKeys.namespaces.key,
  uiResourceKeys.namespaces.list.key,
  uiResourceKeys.namespaces.detail.key,
  uiResourceKeys.apiKeys.key,
  uiResourceKeys.apiKeys.list.key,
  uiResourceKeys.apiKeys.detail.key,
  uiResourceKeys.apiKeys.request.key,
  uiResourceKeys.apiKeys.replaceRequest.key,
  uiResourceKeys.apiKeys.disposeRequest.key,
]

const iamMenuIds: MenuKey[] = [
  uiResourceKeys.users.key,
  uiResourceKeys.organizations.key,
  uiResourceKeys.roles.key,
  uiResourceKeys.applications.key,
]

const iamOperatorUiResourceKeys = [
  ...getMenuUiResourceKeys(iamMenuIds),
  ...initialUiResources
    .filter(
      (resource) =>
        resource.type === uiResourceTypeValues.action &&
        iamMenuIds.some((menuId) => resource.key.startsWith(`${menuId}:`)) &&
        resource.key !==
          uiResourceKeys.users.detail.actions.changeEmploymentStatus,
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
      type: accessPolicyTypes.accessGrant,
      managementType: accessPolicyManagementTypes.system,
      effect: accessPolicyEffects.allow,
      resources: [
        ...uiResourceReferences(resourceKeys),
        ...additionalResources,
      ],
      status: entityStatuses.active,
      createdAt: systemUiAccessCreatedAt,
    } satisfies AccessPolicy,
    assignments,
  }
}

const roleUiAccessPolicies = [
  createUiAccessPolicy(
    backofficeAdministratorAccessPolicyId,
    `${applicationIdentity.displayName} 시스템 관리자 UI 접근`,
    `${applicationIdentity.displayName} 시스템 관리자 역할에 ${applicationIdentity.displayName} 네임스페이스의 모든 UI 리소스를 허용합니다.`,
    initialUiResources.map((resource) => resource.key),
    [
      {
        targetType: accessPolicyAssignmentTargets.role,
        targetId: defaultBackofficeAdminRole.id,
      },
    ],
    [
      {
        type: accessPolicyResourceTypes.endpoint,
        id: localSystemReferences.serviceEndpointIds.importUiResources,
      },
    ],
  ),
  createUiAccessPolicy(
    "45000000-0000-4000-8000-000000000106",
    `${applicationIdentity.displayName} 일반 사용자 UI 접근`,
    `${applicationIdentity.displayName} 일반 사용자 역할에 사용자·조직 조회, 소속 조직 어플리케이션, 정책, 자격증명과 서비스·엔드포인트·네임스페이스 카탈로그의 기본 화면을 허용합니다.`,
    [
      ...generalUserUiResourceKeys,
      uiResourceKeys.home.overview.actions.markNotificationRead,
      uiResourceKeys.approvalDocuments.requestDetail.actions.processRequest,
      uiResourceKeys.approvalDocuments.requestDetail.actions.withdrawRequest,
      uiResourceKeys.approvalDocuments.requestDetail.actions.resubmitRequest,
    ],
    [
      {
        targetType: accessPolicyAssignmentTargets.role,
        targetId: defaultGeneralUserRole.id,
      },
    ],
  ),
  createUiAccessPolicy(
    "45000000-0000-4000-8000-000000000107",
    `${applicationIdentity.displayName} IAM 운영자 UI 접근`,
    `${applicationIdentity.displayName} IAM 운영자 역할에 사용자, 조직, 역할과 어플리케이션의 조회·관리 기능을 허용합니다.`,
    iamOperatorUiResourceKeys,
    [
      {
        targetType: accessPolicyAssignmentTargets.role,
        targetId: defaultIamOperatorRole.id,
      },
    ],
  ),
  createUiAccessPolicy(
    "45000000-0000-4000-8000-000000000103",
    `${applicationIdentity.displayName} 정책 운영자 UI 접근`,
    `${applicationIdentity.displayName} 정책 운영자 역할에 정책 생성·수정·삭제 기능을 추가로 허용합니다.`,
    [
      ...getMenuUiResourceKeys([uiResourceKeys.approvalDocuments.key]),
      ...policyOperatorUiResourceKeys,
    ],
    [
      {
        targetType: accessPolicyAssignmentTargets.role,
        targetId: defaultPolicyOperatorRole.id,
      },
    ],
  ),
  createUiAccessPolicy(
    uiResourceManagerAccessPolicyId,
    `${applicationIdentity.displayName} UI 리소스 관리자 UI 접근`,
    `${applicationIdentity.displayName} UI 리소스 관리자 역할에 리소스 조회·동기화·상태 변경·고아 리소스 정리를 허용합니다.`,
    uiResourceManagerUiResourceKeys,
    [
      {
        targetType: accessPolicyAssignmentTargets.role,
        targetId: defaultUiResourceManagerRole.id,
      },
    ],
    [
      {
        type: accessPolicyResourceTypes.endpoint,
        id: localSystemReferences.serviceEndpointIds.importUiResources,
      },
    ],
  ),
  createUiAccessPolicy(
    "45000000-0000-4000-8000-000000000105",
    `${applicationIdentity.displayName} 서비스 운영자 UI 접근`,
    `${applicationIdentity.displayName} 서비스 운영자 역할에 소유 조직의 서비스와 엔드포인트 관리 및 자격증명 등록 기능을 허용합니다.`,
    [
      ...getMenuUiResourceKeys([
        uiResourceKeys.services.key,
        uiResourceKeys.serviceEndpoints.key,
        uiResourceKeys.apiKeys.key,
      ]),
      ...initialUiResources
        .filter(
          (resource) =>
            resource.type === uiResourceTypeValues.action &&
            (resource.key.startsWith(`${uiResourceKeys.services.key}:`) ||
              resource.key.startsWith(
                `${uiResourceKeys.serviceEndpoints.key}:`,
              )),
        )
        .map((resource) => resource.key),
      uiResourceKeys.apiKeys.list.actions.registerCredential,
      uiResourceKeys.apiKeys.detail.actions.emergencyRevokeCredential,
    ],
    [
      {
        targetType: accessPolicyAssignmentTargets.role,
        targetId: defaultServiceOperatorRole.id,
      },
    ],
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
    expiresAt: null,
    createdAt: systemUiAccessCreatedAt,
  }))

export const initialBackofficeState: BackofficeState = {
  systemReferences: localSystemReferences,
  organizations: [],
  applications: [],
  users: [],
  roles: [
    defaultBackofficeAdminRole,
    defaultPolicyOperatorRole,
    defaultIamOperatorRole,
    defaultGeneralUserRole,
    defaultUiResourceManagerRole,
    defaultServiceOperatorRole,
  ],
  approvalLines: [],
  approvalLineRevisions: [],
  accessPolicies: systemUiAccessPolicies,
  accessPolicyAssignments: systemUiAccessPolicyAssignments,
  approvalDocuments: [],
  notifications: [],
  services: [],
  serviceEndpoints: [],
  serviceEndpointFields: [],
  serviceEndpointRevisions: [],
  credentialLifecycleSettings: {
    expirationPeriodDays: 365,
    rotationIntervalDays: 90,
    updatedAt: systemUiAccessCreatedAt,
    updatedByUserId: null,
  },
  credentialRegistrationAttempts: [],
  apiKeys: [],
  namespaces: [defaultNamespace],
  uiResources: initialUiResources,
  uiResourceSyncHistories: [],
  auditEvents: [],
}
