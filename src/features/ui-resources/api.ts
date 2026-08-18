import type { CommandResult } from "@/domain/common"
import type {
  NamespaceInput,
  Namespace,
  UiResource,
  UiResourceImportInput,
  UiResourceImportResult,
  UiResourceRestoreResult,
} from "@/features/ui-resources/model"
import type { EntityStatus } from "@/domain/common"

export interface UiResourceApi {
  createNamespace: (
    input: NamespaceInput,
    requesterId: string,
  ) => Promise<CommandResult<Namespace>>
  updateNamespaceManager: (
    namespaceId: string,
    managerRoleId: string,
    requesterId: string,
  ) => Promise<CommandResult<Namespace>>
  retireNamespace: (
    namespaceId: string,
    requesterId: string,
  ) => Promise<CommandResult<Namespace>>
  importUiResources: (
    input: UiResourceImportInput,
    requesterId: string,
  ) => Promise<CommandResult<UiResourceImportResult>>
  deleteOrphanedUiResources: (
    resourceIds: string[],
    requesterId: string,
  ) => Promise<CommandResult<UiResource[]>>
  setUiResourceStatus: (
    resourceId: string,
    status: EntityStatus,
    requesterId: string,
  ) => Promise<CommandResult<UiResource>>
  restoreUiResourceSync: (
    historyId: string,
    requesterId: string,
  ) => Promise<CommandResult<UiResourceRestoreResult>>
}

export interface UiResourceApiClient {
  createNamespace: (request: {
    body: NamespaceInput
    requesterId: string
  }) => Promise<CommandResult<Namespace>>
  updateNamespaceManager: (request: {
    namespaceId: string
    managerRoleId: string
    requesterId: string
  }) => Promise<CommandResult<Namespace>>
  retireNamespace: (request: {
    namespaceId: string
    requesterId: string
  }) => Promise<CommandResult<Namespace>>
  importUiResources: (request: {
    body: UiResourceImportInput
    requesterId: string
  }) => Promise<CommandResult<UiResourceImportResult>>
  deleteOrphanedUiResources: (request: {
    resourceIds: string[]
    requesterId: string
  }) => Promise<CommandResult<UiResource[]>>
  setUiResourceStatus: (request: {
    resourceId: string
    status: EntityStatus
    requesterId: string
  }) => Promise<CommandResult<UiResource>>
  restoreUiResourceSync: (request: {
    historyId: string
    requesterId: string
  }) => Promise<CommandResult<UiResourceRestoreResult>>
}
