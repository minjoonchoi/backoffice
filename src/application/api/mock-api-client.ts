import { createLocalAccessPolicyApi } from "@/features/access-policies/local-api"
import { createLocalApprovalDocumentApi } from "@/features/access-policies/approval-document-local-api"
import type { BackofficeApiClient } from "@/application/api/api-client"
import type { BackofficeStateUpdater } from "@/application/api/local-state"
import type { BackofficeState } from "@/application/state/model"
import { createLocalCredentialApi } from "@/features/credentials/local-api"
import { createLocalHomeApi } from "@/features/home/local-api"
import {
  HttpExternalCredentialRegistrar,
  HttpInternalCredentialRegistrar,
  type ExternalCredentialRegistrar,
  type InternalCredentialRegistrar,
} from "@/features/credentials/internal-credential-registration"
import {
  createLocalIamApi,
  synchronizeGeneralUserRole,
  synchronizeOrganizationLeaderGroup,
} from "@/features/iam/local-api"
import { createLocalRequestTemplateApi } from "@/features/request-templates/local-api"
import { createLocalServiceCatalogApi } from "@/features/service-catalog/local-api"
import { createLocalUiResourceApi } from "@/features/ui-resources/local-api"

export type MockBackofficeApiClientOptions = {
  initialState: BackofficeState
  internalCredentialRegistrar?: InternalCredentialRegistrar
  externalCredentialRegistrar?: ExternalCredentialRegistrar
}

function prepareMockState(initialState: BackofficeState): BackofficeState {
  const state = structuredClone(initialState)
  return {
    ...state,
    groups: synchronizeOrganizationLeaderGroup(
      state.groups,
      state.organizations,
      state.systemReferences,
    ),
    roles: synchronizeGeneralUserRole(
      state.roles,
      state.users,
      state.systemReferences,
    ),
  }
}

/** YAML/system fixture를 실제 API와 같은 request/response 계약으로 제공한다. */
export function createMockBackofficeApiClient({
  initialState,
  internalCredentialRegistrar = new HttpInternalCredentialRegistrar(),
  externalCredentialRegistrar = new HttpExternalCredentialRegistrar(),
}: MockBackofficeApiClientOptions): BackofficeApiClient {
  let state = prepareMockState(initialState)
  const updateState: BackofficeStateUpdater = (update) => {
    state = update(state)
  }
  const iam = () => createLocalIamApi(state, updateState)
  const home = () => createLocalHomeApi(state, updateState)
  const requestTemplates = () =>
    createLocalRequestTemplateApi(state, updateState)
  const accessPolicies = () => createLocalAccessPolicyApi(state, updateState)
  const approvalDocuments = () =>
    createLocalApprovalDocumentApi(state, updateState)
  const credentials = () =>
    createLocalCredentialApi(
      state,
      updateState,
      internalCredentialRegistrar,
      externalCredentialRegistrar,
    )
  const serviceCatalog = () => createLocalServiceCatalogApi(state, updateState)
  const uiResources = () => createLocalUiResourceApi(state, updateState)

  return {
    getSnapshot: async () => {
      await Promise.resolve()
      return { data: structuredClone(state) }
    },
    home: {
      markNotificationRead: ({ notificationId, requesterId }) =>
        home().markNotificationRead(notificationId, requesterId),
    },
    iam: {
      createOrganization: ({ body }) => iam().createOrganization(body),
      updateOrganization: ({ id, body }) => iam().updateOrganization(id, body),
      addUsersToOrganization: ({ organizationId, userIds }) =>
        iam().addUsersToOrganization(organizationId, userIds),
      addOrganizationsToUser: ({ userId, organizationIds }) =>
        iam().addOrganizationsToUser(userId, organizationIds),
      removeUsersFromOrganizations: ({ userIds, organizationIds }) =>
        iam().removeUsersFromOrganizations(userIds, organizationIds),
      createUser: ({ body }) => iam().createUser(body),
      createRole: ({ body }) => iam().createRole(body),
      updateRole: ({ roleId, body, requesterId }) =>
        iam().updateRole(roleId, body, requesterId),
      deleteRole: ({ roleId, requesterId }) =>
        iam().deleteRole(roleId, requesterId),
      createGroup: ({ body }) => iam().createGroup(body),
      updateGroup: ({ groupId, body, requesterId }) =>
        iam().updateGroup(groupId, body, requesterId),
      deleteGroup: ({ groupId, requesterId }) =>
        iam().deleteGroup(groupId, requesterId),
      assignUsersToGroups: ({ userIds, groupIds }) =>
        iam().assignUsersToGroups(userIds, groupIds),
      unassignUsersFromGroups: ({ userIds, groupIds }) =>
        iam().unassignUsersFromGroups(userIds, groupIds),
      assignUsersToRoles: ({ userIds, roleIds }) =>
        iam().assignUsersToRoles(userIds, roleIds),
      assignOrganizationsToRoles: ({ organizationIds, roleIds }) =>
        iam().assignOrganizationsToRoles(organizationIds, roleIds),
      unassignUsersFromRoles: ({ userIds, roleIds }) =>
        iam().unassignUsersFromRoles(userIds, roleIds),
      unassignOrganizationsFromRoles: ({ organizationIds, roleIds }) =>
        iam().unassignOrganizationsFromRoles(organizationIds, roleIds),
      setUserEmploymentStatus: ({ userId, status }) =>
        iam().setUserEmploymentStatus(userId, status),
    },
    requestTemplates: {
      createApprovalLine: ({ body }) =>
        requestTemplates().createApprovalLine(body),
      updateApprovalLine: ({ id, body }) =>
        requestTemplates().updateApprovalLine(id, body),
      setApprovalLineStatus: ({ approvalLineId, status }) =>
        requestTemplates().setApprovalLineStatus(approvalLineId, status),
    },
    accessPolicies: {
      assignAccessPoliciesToTarget: (request) =>
        accessPolicies().assignAccessPoliciesToTarget(
          request.accessPolicyIds,
          request.targetType,
          request.targetId,
          request.requesterId,
        ),
      unassignAccessPolicyFromTarget: ({ assignmentId, requesterId }) =>
        accessPolicies().unassignAccessPolicyFromTarget(
          assignmentId,
          requesterId,
        ),
      createAccessPolicy: ({ body, requesterId }) =>
        accessPolicies().createAccessPolicy(body, requesterId),
      updateAccessPolicy: ({ accessPolicyId, body, requesterId }) =>
        accessPolicies().updateAccessPolicy(accessPolicyId, body, requesterId),
      deleteAccessPolicy: ({ accessPolicyId, requesterId }) =>
        accessPolicies().deleteAccessPolicy(accessPolicyId, requesterId),
    },
    approvalDocuments: {
      createApprovalDocument: ({ body }) =>
        approvalDocuments().createApprovalDocument(body),
      approveApprovalDocument: ({ approvalDocumentId }) =>
        approvalDocuments().approveApprovalDocument(approvalDocumentId),
    },
    credentials: {
      registerApiKey: ({ body }) => credentials().registerApiKey(body),
    },
    serviceCatalog: {
      createService: ({ body }) => serviceCatalog().createService(body),
      updateService: ({ id, body }) => serviceCatalog().updateService(id, body),
      deleteService: ({ id }) => serviceCatalog().deleteService(id),
      createServiceEndpoint: ({ body }) =>
        serviceCatalog().createServiceEndpoint(body),
      updateServiceEndpoint: ({ id, body }) =>
        serviceCatalog().updateServiceEndpoint(id, body),
      deleteServiceEndpoint: ({ id }) =>
        serviceCatalog().deleteServiceEndpoint(id),
    },
    uiResources: {
      createUiNamespace: ({ body, requesterId }) =>
        uiResources().createUiNamespace(body, requesterId),
      importUiResources: ({ body, requesterId }) =>
        uiResources().importUiResources(body, requesterId),
      deleteOrphanedUiResources: ({ resourceIds, requesterId }) =>
        uiResources().deleteOrphanedUiResources(resourceIds, requesterId),
      setUiResourceStatus: ({ resourceId, status, requesterId }) =>
        uiResources().setUiResourceStatus(resourceId, status, requesterId),
    },
  }
}
