import type { CommandResult } from "@/domain/common"
import type {
  UiNamespaceInput,
  UiNamespace,
  UiResource,
  UiResourceImportInput,
  UiResourceImportResult,
} from "@/features/ui-resources/model"
import type { EntityStatus } from "@/domain/common"

export interface UiResourceApi {
  createUiNamespace: (
    input: UiNamespaceInput,
    requesterId: string,
  ) => Promise<CommandResult<UiNamespace>>
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
}

export interface UiResourceApiClient {
  createUiNamespace: (request: {
    body: UiNamespaceInput
    requesterId: string
  }) => Promise<CommandResult<UiNamespace>>
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
}
