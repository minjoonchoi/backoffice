import type {
  BackofficeApiClient,
  BackofficeCommands,
} from "@/application/api/api-client"
import type { CommandResult } from "@/domain/common"

export type RunBackofficeCommand = <Entity>(
  request: Promise<CommandResult<Entity>>,
) => Promise<CommandResult<Entity>>

/** API 요청 DTO 매핑을 React 상태 수명주기와 분리한다. */
export function createBackofficeCommands(
  apiClient: BackofficeApiClient,
  runCommand: RunBackofficeCommand,
  getSessionUserId: () => string | null,
): BackofficeCommands {
  const resolveRequesterId = (requesterId?: string) =>
    requesterId ?? getSessionUserId() ?? ""
  return {
    createApplication: (input, requesterId) =>
      runCommand(apiClient.iam.createApplication({ body: input, requesterId })),
    updateApplication: (id, input, requesterId) =>
      runCommand(
        apiClient.iam.updateApplication({
          applicationId: id,
          body: input,
          requesterId,
        }),
      ),
    deleteApplication: (id, requesterId) =>
      runCommand(
        apiClient.iam.deleteApplication({
          applicationId: id,
          requesterId,
        }),
      ),
    markNotificationRead: (notificationId, requesterId) =>
      runCommand(
        apiClient.home.markNotificationRead({ notificationId, requesterId }),
      ),
    createOrganization: (input, requesterId) =>
      runCommand(
        apiClient.iam.createOrganization({
          body: input,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    updateOrganization: (id, input, requesterId) =>
      runCommand(
        apiClient.iam.updateOrganization({
          id,
          body: input,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    addUsersToOrganization: (id, userIds, requesterId) =>
      runCommand(
        apiClient.iam.addUsersToOrganization({
          organizationId: id,
          userIds,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    addOrganizationsToUser: (id, organizationIds, requesterId) =>
      runCommand(
        apiClient.iam.addOrganizationsToUser({
          userId: id,
          organizationIds,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    removeUsersFromOrganizations: (userIds, organizationIds, requesterId) =>
      runCommand(
        apiClient.iam.removeUsersFromOrganizations({
          userIds,
          organizationIds,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    createUser: (input, requesterId) =>
      runCommand(
        apiClient.iam.createUser({
          body: input,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    createRole: (input, requesterId) =>
      runCommand(
        apiClient.iam.createRole({
          body: input,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    updateRole: (id, input, requesterId) =>
      runCommand(
        apiClient.iam.updateRole({ roleId: id, body: input, requesterId }),
      ),
    deleteRole: (id, requesterId) =>
      runCommand(apiClient.iam.deleteRole({ roleId: id, requesterId })),
    assignUsersToRoles: (userIds, roleIds, requesterId) =>
      runCommand(
        apiClient.iam.assignUsersToRoles({
          userIds,
          roleIds,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    assignOrganizationsToRoles: (organizationIds, roleIds, requesterId) =>
      runCommand(
        apiClient.iam.assignOrganizationsToRoles({
          organizationIds,
          roleIds,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    unassignUsersFromRoles: (userIds, roleIds, requesterId) =>
      runCommand(
        apiClient.iam.unassignUsersFromRoles({
          userIds,
          roleIds,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    unassignOrganizationsFromRoles: (organizationIds, roleIds, requesterId) =>
      runCommand(
        apiClient.iam.unassignOrganizationsFromRoles({
          organizationIds,
          roleIds,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    setUserEmploymentStatus: (id, status, requesterId) =>
      runCommand(
        apiClient.iam.setUserEmploymentStatus({
          userId: id,
          status,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    createApprovalLine: (input, requesterId) =>
      runCommand(
        apiClient.requestTemplates.createApprovalLine({
          body: input,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    cloneApprovalLine: (sourceApprovalLineId, name, requesterId) =>
      runCommand(
        apiClient.requestTemplates.cloneApprovalLine({
          sourceApprovalLineId,
          name,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    updateApprovalLine: (id, input, requesterId) =>
      runCommand(
        apiClient.requestTemplates.updateApprovalLine({
          id,
          body: input,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    setApprovalLineStatus: (id, status, requesterId) =>
      runCommand(
        apiClient.requestTemplates.setApprovalLineStatus({
          approvalLineId: id,
          status,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    createAccessPolicy: (input, requesterId) =>
      runCommand(
        apiClient.accessPolicies.createAccessPolicy({
          body: input,
          requesterId,
        }),
      ),
    analyzeAccessPolicyUpdate: (id, input, requesterId) =>
      apiClient.accessPolicies.analyzeAccessPolicyUpdate({
        accessPolicyId: id,
        body: input,
        requesterId,
      }),
    assignAccessPoliciesToTarget: (
      accessPolicyIds,
      targetType,
      targetId,
      requesterId,
    ) =>
      runCommand(
        apiClient.accessPolicies.assignAccessPoliciesToTarget({
          accessPolicyIds,
          targetType,
          targetId,
          requesterId,
        }),
      ),
    unassignAccessPolicyFromTarget: (assignmentId, requesterId) =>
      runCommand(
        apiClient.accessPolicies.unassignAccessPolicyFromTarget({
          assignmentId,
          requesterId,
        }),
      ),
    updateAccessPolicy: (id, input, requesterId) =>
      runCommand(
        apiClient.accessPolicies.updateAccessPolicy({
          accessPolicyId: id,
          body: input,
          requesterId,
        }),
      ),
    deleteAccessPolicy: (id, requesterId) =>
      runCommand(
        apiClient.accessPolicies.deleteAccessPolicy({
          accessPolicyId: id,
          requesterId,
        }),
      ),
    createApprovalDocument: (input) =>
      runCommand(
        apiClient.approvalDocuments.createApprovalDocument({ body: input }),
      ),
    processApprovalDocument: (input) =>
      runCommand(
        apiClient.approvalDocuments.processApprovalDocument({ body: input }),
      ),
    withdrawApprovalDocument: (input) =>
      runCommand(
        apiClient.approvalDocuments.withdrawApprovalDocument({ body: input }),
      ),
    resubmitApprovalDocument: (input) =>
      runCommand(
        apiClient.approvalDocuments.resubmitApprovalDocument({ body: input }),
      ),
    registerApiKey: (input) =>
      runCommand(apiClient.credentials.registerApiKey({ body: input })),
    updateCredentialLifecycleSettings: (input, requesterId) =>
      runCommand(
        apiClient.credentials.updateCredentialLifecycleSettings({
          body: input,
          requesterId,
        }),
      ),
    emergencyRevokeApiKey: (input) =>
      runCommand(apiClient.credentials.emergencyRevokeApiKey({ body: input })),
    createService: (input, requesterId) =>
      runCommand(
        apiClient.serviceCatalog.createService({
          body: input,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    updateService: (id, input, requesterId) =>
      runCommand(
        apiClient.serviceCatalog.updateService({
          id,
          body: input,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    deleteService: (id, requesterId) =>
      runCommand(
        apiClient.serviceCatalog.deleteService({
          id,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    createServiceEndpoint: (input, requesterId) =>
      runCommand(
        apiClient.serviceCatalog.createServiceEndpoint({
          body: input,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    analyzeServiceEndpointSync: (input, requesterId) =>
      apiClient.serviceCatalog.analyzeServiceEndpointSync({
        body: input,
        requesterId,
      }),
    synchronizeServiceEndpoints: (input, selectedOperationKeys, requesterId) =>
      runCommand(
        apiClient.serviceCatalog.synchronizeServiceEndpoints({
          body: input,
          selectedOperationKeys,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    updateServiceEndpoint: (id, input, requesterId) =>
      runCommand(
        apiClient.serviceCatalog.updateServiceEndpoint({
          id,
          body: input,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    deleteServiceEndpoint: (id, requesterId) =>
      runCommand(
        apiClient.serviceCatalog.deleteServiceEndpoint({
          id,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    setServiceEndpointLifecycle: (id, lifecycle, requesterId) =>
      runCommand(
        apiClient.serviceCatalog.setServiceEndpointLifecycle({
          id,
          lifecycle,
          requesterId: resolveRequesterId(requesterId),
        }),
      ),
    createNamespace: (input, requesterId) =>
      runCommand(
        apiClient.uiResources.createNamespace({
          body: input,
          requesterId,
        }),
      ),
    updateNamespaceManager: (namespaceId, managerRoleId, requesterId) =>
      runCommand(
        apiClient.uiResources.updateNamespaceManager({
          namespaceId,
          managerRoleId,
          requesterId,
        }),
      ),
    retireNamespace: (namespaceId, requesterId) =>
      runCommand(
        apiClient.uiResources.retireNamespace({ namespaceId, requesterId }),
      ),
    importUiResources: (input, requesterId) =>
      runCommand(
        apiClient.uiResources.importUiResources({
          body: input,
          requesterId,
        }),
      ),
    deleteOrphanedUiResources: (resourceIds, requesterId) =>
      runCommand(
        apiClient.uiResources.deleteOrphanedUiResources({
          resourceIds,
          requesterId,
        }),
      ),
    setUiResourceStatus: (resourceId, status, requesterId) =>
      runCommand(
        apiClient.uiResources.setUiResourceStatus({
          resourceId,
          status,
          requesterId,
        }),
      ),
    restoreUiResourceSync: (historyId, requesterId) =>
      runCommand(
        apiClient.uiResources.restoreUiResourceSync({
          historyId,
          requesterId,
        }),
      ),
  }
}
