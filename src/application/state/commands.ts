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
): BackofficeCommands {
  return {
    markNotificationRead: (notificationId, requesterId) =>
      runCommand(
        apiClient.home.markNotificationRead({ notificationId, requesterId }),
      ),
    createOrganization: (input) =>
      runCommand(apiClient.iam.createOrganization({ body: input })),
    updateOrganization: (id, input) =>
      runCommand(apiClient.iam.updateOrganization({ id, body: input })),
    addUsersToOrganization: (id, userIds) =>
      runCommand(
        apiClient.iam.addUsersToOrganization({
          organizationId: id,
          userIds,
        }),
      ),
    addOrganizationsToUser: (id, organizationIds) =>
      runCommand(
        apiClient.iam.addOrganizationsToUser({
          userId: id,
          organizationIds,
        }),
      ),
    removeUsersFromOrganizations: (userIds, organizationIds) =>
      runCommand(
        apiClient.iam.removeUsersFromOrganizations({
          userIds,
          organizationIds,
        }),
      ),
    createUser: (input) =>
      runCommand(apiClient.iam.createUser({ body: input })),
    createRole: (input) =>
      runCommand(apiClient.iam.createRole({ body: input })),
    updateRole: (id, input, requesterId) =>
      runCommand(
        apiClient.iam.updateRole({ roleId: id, body: input, requesterId }),
      ),
    deleteRole: (id, requesterId) =>
      runCommand(apiClient.iam.deleteRole({ roleId: id, requesterId })),
    createGroup: (input) =>
      runCommand(apiClient.iam.createGroup({ body: input })),
    updateGroup: (id, input, requesterId) =>
      runCommand(
        apiClient.iam.updateGroup({ groupId: id, body: input, requesterId }),
      ),
    deleteGroup: (id, requesterId) =>
      runCommand(apiClient.iam.deleteGroup({ groupId: id, requesterId })),
    assignUsersToGroups: (userIds, groupIds) =>
      runCommand(apiClient.iam.assignUsersToGroups({ userIds, groupIds })),
    unassignUsersFromGroups: (userIds, groupIds) =>
      runCommand(apiClient.iam.unassignUsersFromGroups({ userIds, groupIds })),
    assignUsersToRoles: (userIds, roleIds) =>
      runCommand(apiClient.iam.assignUsersToRoles({ userIds, roleIds })),
    assignOrganizationsToRoles: (organizationIds, roleIds) =>
      runCommand(
        apiClient.iam.assignOrganizationsToRoles({
          organizationIds,
          roleIds,
        }),
      ),
    unassignUsersFromRoles: (userIds, roleIds) =>
      runCommand(apiClient.iam.unassignUsersFromRoles({ userIds, roleIds })),
    unassignOrganizationsFromRoles: (organizationIds, roleIds) =>
      runCommand(
        apiClient.iam.unassignOrganizationsFromRoles({
          organizationIds,
          roleIds,
        }),
      ),
    setUserEmploymentStatus: (id, status) =>
      runCommand(apiClient.iam.setUserEmploymentStatus({ userId: id, status })),
    createApprovalLine: (input) =>
      runCommand(
        apiClient.requestTemplates.createApprovalLine({ body: input }),
      ),
    updateApprovalLine: (id, input) =>
      runCommand(
        apiClient.requestTemplates.updateApprovalLine({ id, body: input }),
      ),
    setApprovalLineStatus: (id, status) =>
      runCommand(
        apiClient.requestTemplates.setApprovalLineStatus({
          approvalLineId: id,
          status,
        }),
      ),
    createAccessPolicy: (input, requesterId) =>
      runCommand(
        apiClient.accessPolicies.createAccessPolicy({
          body: input,
          requesterId,
        }),
      ),
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
    approveApprovalDocument: (id) =>
      runCommand(
        apiClient.approvalDocuments.approveApprovalDocument({
          approvalDocumentId: id,
        }),
      ),
    registerApiKey: (input) =>
      runCommand(apiClient.credentials.registerApiKey({ body: input })),
    createService: (input) =>
      runCommand(apiClient.serviceCatalog.createService({ body: input })),
    updateService: (id, input) =>
      runCommand(apiClient.serviceCatalog.updateService({ id, body: input })),
    deleteService: (id) =>
      runCommand(apiClient.serviceCatalog.deleteService({ id })),
    createServiceEndpoint: (input) =>
      runCommand(
        apiClient.serviceCatalog.createServiceEndpoint({ body: input }),
      ),
    updateServiceEndpoint: (id, input) =>
      runCommand(
        apiClient.serviceCatalog.updateServiceEndpoint({ id, body: input }),
      ),
    deleteServiceEndpoint: (id) =>
      runCommand(apiClient.serviceCatalog.deleteServiceEndpoint({ id })),
    createUiNamespace: (input, requesterId) =>
      runCommand(
        apiClient.uiResources.createUiNamespace({
          body: input,
          requesterId,
        }),
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
  }
}
