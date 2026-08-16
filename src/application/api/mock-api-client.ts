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
  synchronizeOrganizationLeaderRole,
} from "@/features/iam/local-api"
import { createLocalRequestTemplateApi } from "@/features/request-templates/local-api"
import { createLocalServiceCatalogApi } from "@/features/service-catalog/local-api"
import { createLocalUiResourceApi } from "@/features/ui-resources/local-api"
import { createAuditEvents } from "@/features/audit/audit-history"

export type MockBackofficeApiClientOptions = {
  initialState: BackofficeState
  internalCredentialRegistrar?: InternalCredentialRegistrar
  externalCredentialRegistrar?: ExternalCredentialRegistrar
  getActorUserId?: () => string | null
}

function prepareMockState(initialState: BackofficeState): BackofficeState {
  const state = structuredClone(initialState)
  return {
    ...state,
    roles: synchronizeOrganizationLeaderRole(
      synchronizeGeneralUserRole(
        state.roles,
        state.users,
        state.systemReferences,
      ),
      state.organizations,
      state.systemReferences,
    ),
  }
}

/** YAML/system fixture를 실제 API와 같은 request/response 계약으로 제공한다. */
export function createMockBackofficeApiClient({
  initialState,
  internalCredentialRegistrar = new HttpInternalCredentialRegistrar(),
  externalCredentialRegistrar = new HttpExternalCredentialRegistrar(),
  getActorUserId = () => null,
}: MockBackofficeApiClientOptions): BackofficeApiClient {
  let state = prepareMockState(initialState)
  const updateState: BackofficeStateUpdater = (update) => {
    const previous = state
    const next = update(previous)
    const events = createAuditEvents(previous, next, getActorUserId())
    state = events.length
      ? { ...next, auditEvents: [...next.auditEvents, ...events] }
      : next
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
      createApplication: ({ body, requesterId }) =>
        iam().createApplication(body, requesterId),
      updateApplication: ({ applicationId, body, requesterId }) =>
        iam().updateApplication(applicationId, body, requesterId),
      deleteApplication: ({ applicationId, requesterId }) =>
        iam().deleteApplication(applicationId, requesterId),
      createOrganization: ({ body, requesterId }) =>
        iam().createOrganization(body, requesterId),
      updateOrganization: ({ id, body, requesterId }) =>
        iam().updateOrganization(id, body, requesterId),
      addUsersToOrganization: ({ organizationId, userIds, requesterId }) =>
        iam().addUsersToOrganization(organizationId, userIds, requesterId),
      addOrganizationsToUser: ({ userId, organizationIds, requesterId }) =>
        iam().addOrganizationsToUser(userId, organizationIds, requesterId),
      removeUsersFromOrganizations: ({
        userIds,
        organizationIds,
        requesterId,
      }) =>
        iam().removeUsersFromOrganizations(
          userIds,
          organizationIds,
          requesterId,
        ),
      createUser: ({ body, requesterId }) =>
        iam().createUser(body, requesterId),
      createRole: ({ body, requesterId }) =>
        iam().createRole(body, requesterId),
      updateRole: ({ roleId, body, requesterId }) =>
        iam().updateRole(roleId, body, requesterId),
      deleteRole: ({ roleId, requesterId }) =>
        iam().deleteRole(roleId, requesterId),
      assignUsersToRoles: ({ userIds, roleIds, requesterId }) =>
        iam().assignUsersToRoles(userIds, roleIds, requesterId),
      assignOrganizationsToRoles: ({ organizationIds, roleIds, requesterId }) =>
        iam().assignOrganizationsToRoles(organizationIds, roleIds, requesterId),
      unassignUsersFromRoles: ({ userIds, roleIds, requesterId }) =>
        iam().unassignUsersFromRoles(userIds, roleIds, requesterId),
      unassignOrganizationsFromRoles: ({
        organizationIds,
        roleIds,
        requesterId,
      }) =>
        iam().unassignOrganizationsFromRoles(
          organizationIds,
          roleIds,
          requesterId,
        ),
      setUserEmploymentStatus: ({ userId, status, requesterId }) =>
        iam().setUserEmploymentStatus(userId, status, requesterId),
    },
    requestTemplates: {
      createApprovalLine: ({ body, requesterId }) =>
        requestTemplates().createApprovalLine(body, requesterId),
      cloneApprovalLine: ({ sourceApprovalLineId, name, requesterId }) =>
        requestTemplates().cloneApprovalLine(
          sourceApprovalLineId,
          name,
          requesterId,
        ),
      updateApprovalLine: ({ id, body, requesterId }) =>
        requestTemplates().updateApprovalLine(id, body, requesterId),
      setApprovalLineStatus: ({ approvalLineId, status, requesterId }) =>
        requestTemplates().setApprovalLineStatus(
          approvalLineId,
          status,
          requesterId,
        ),
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
      analyzeAccessPolicyUpdate: ({ accessPolicyId, body, requesterId }) =>
        accessPolicies().analyzeAccessPolicyUpdate(
          accessPolicyId,
          body,
          requesterId,
        ),
      updateAccessPolicy: ({ accessPolicyId, body, requesterId }) =>
        accessPolicies().updateAccessPolicy(accessPolicyId, body, requesterId),
      deleteAccessPolicy: ({ accessPolicyId, requesterId }) =>
        accessPolicies().deleteAccessPolicy(accessPolicyId, requesterId),
    },
    approvalDocuments: {
      createApprovalDocument: ({ body }) =>
        approvalDocuments().createApprovalDocument(body),
      processApprovalDocument: ({ body }) =>
        approvalDocuments().processApprovalDocument(body),
      withdrawApprovalDocument: ({ body }) =>
        approvalDocuments().withdrawApprovalDocument(body),
      resubmitApprovalDocument: ({ body }) =>
        approvalDocuments().resubmitApprovalDocument(body),
    },
    credentials: {
      registerApiKey: ({ body }) => credentials().registerApiKey(body),
      updateCredentialLifecycleSettings: ({ body, requesterId }) =>
        credentials().updateCredentialLifecycleSettings(body, requesterId),
      emergencyRevokeApiKey: ({ body }) =>
        credentials().emergencyRevokeApiKey(body),
    },
    serviceCatalog: {
      createService: ({ body, requesterId }) =>
        serviceCatalog().createService(body, requesterId),
      updateService: ({ id, body, requesterId }) =>
        serviceCatalog().updateService(id, body, requesterId),
      deleteService: ({ id, requesterId }) =>
        serviceCatalog().deleteService(id, requesterId),
      createServiceEndpoint: ({ body, requesterId }) =>
        serviceCatalog().createServiceEndpoint(body, requesterId),
      analyzeServiceEndpointSync: ({ body, requesterId }) =>
        serviceCatalog().analyzeServiceEndpointSync(body, requesterId),
      synchronizeServiceEndpoints: ({
        body,
        selectedOperationKeys,
        requesterId,
      }) =>
        serviceCatalog().synchronizeServiceEndpoints(
          body,
          selectedOperationKeys,
          requesterId,
        ),
      updateServiceEndpoint: ({ id, body, requesterId }) =>
        serviceCatalog().updateServiceEndpoint(id, body, requesterId),
      deleteServiceEndpoint: ({ id, requesterId }) =>
        serviceCatalog().deleteServiceEndpoint(id, requesterId),
      setServiceEndpointLifecycle: ({ id, lifecycle, requesterId }) =>
        serviceCatalog().setServiceEndpointLifecycle(
          id,
          lifecycle,
          requesterId,
        ),
    },
    uiResources: {
      createNamespace: ({ body, requesterId }) =>
        uiResources().createNamespace(body, requesterId),
      updateNamespaceManager: ({ namespaceId, managerRoleId, requesterId }) =>
        uiResources().updateNamespaceManager(
          namespaceId,
          managerRoleId,
          requesterId,
        ),
      retireNamespace: ({ namespaceId, requesterId }) =>
        uiResources().retireNamespace(namespaceId, requesterId),
      importUiResources: ({ body, requesterId }) =>
        uiResources().importUiResources(body, requesterId),
      deleteOrphanedUiResources: ({ resourceIds, requesterId }) =>
        uiResources().deleteOrphanedUiResources(resourceIds, requesterId),
      setUiResourceStatus: ({ resourceId, status, requesterId }) =>
        uiResources().setUiResourceStatus(resourceId, status, requesterId),
      restoreUiResourceSync: ({ historyId, requesterId }) =>
        uiResources().restoreUiResourceSync(historyId, requesterId),
    },
  }
}
