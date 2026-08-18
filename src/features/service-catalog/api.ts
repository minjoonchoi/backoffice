import type { CommandResult } from "@/domain/common"
import type {
  EndpointLifecycle,
  ManagedService,
  ServiceInput,
  ServiceEndpoint,
  ServiceEndpointInput,
} from "@/features/service-catalog/model"
import type { EndpointSyncPlan } from "@/features/service-catalog/endpoint-sync"

export type ServiceEndpointSyncManifestInput = {
  serviceId: string
  endpoints: Omit<ServiceEndpointInput, "serviceId">[]
}

export type ServiceEndpointSyncResult = Readonly<{
  addedCount: number
  updatedCount: number
  deletedCount: number
  notifiedUserCount: number
}>

export interface ServiceCatalogApi {
  createService: (
    input: ServiceInput,
    requesterId?: string,
  ) => Promise<CommandResult<ManagedService>>
  updateService: (
    id: string,
    input: ServiceInput,
    requesterId?: string,
  ) => Promise<CommandResult<ManagedService>>
  deleteService: (
    id: string,
    requesterId?: string,
  ) => Promise<CommandResult<ManagedService>>
  createServiceEndpoint: (
    input: ServiceEndpointInput,
    requesterId?: string,
  ) => Promise<CommandResult<ServiceEndpoint>>
  analyzeServiceEndpointSync: (
    input: ServiceEndpointSyncManifestInput,
    requesterId: string,
  ) => Promise<CommandResult<EndpointSyncPlan>>
  synchronizeServiceEndpoints: (
    input: ServiceEndpointSyncManifestInput,
    selectedOperationKeys: readonly string[],
    requesterId: string,
  ) => Promise<CommandResult<ServiceEndpointSyncResult>>
  updateServiceEndpoint: (
    id: string,
    input: ServiceEndpointInput,
    requesterId?: string,
  ) => Promise<CommandResult<ServiceEndpoint>>
  deleteServiceEndpoint: (
    id: string,
    requesterId?: string,
  ) => Promise<CommandResult<ServiceEndpoint>>
  setServiceEndpointLifecycle: (
    id: string,
    lifecycle: EndpointLifecycle,
    requesterId?: string,
  ) => Promise<CommandResult<ServiceEndpoint>>
}

export interface ServiceCatalogApiClient {
  createService: (request: {
    body: ServiceInput
    requesterId: string
  }) => Promise<CommandResult<ManagedService>>
  updateService: (request: {
    id: string
    body: ServiceInput
    requesterId: string
  }) => Promise<CommandResult<ManagedService>>
  deleteService: (request: {
    id: string
    requesterId: string
  }) => Promise<CommandResult<ManagedService>>
  createServiceEndpoint: (request: {
    body: ServiceEndpointInput
    requesterId: string
  }) => Promise<CommandResult<ServiceEndpoint>>
  analyzeServiceEndpointSync: (request: {
    body: ServiceEndpointSyncManifestInput
    requesterId: string
  }) => Promise<CommandResult<EndpointSyncPlan>>
  synchronizeServiceEndpoints: (request: {
    body: ServiceEndpointSyncManifestInput
    selectedOperationKeys: readonly string[]
    requesterId: string
  }) => Promise<CommandResult<ServiceEndpointSyncResult>>
  updateServiceEndpoint: (request: {
    id: string
    body: ServiceEndpointInput
    requesterId: string
  }) => Promise<CommandResult<ServiceEndpoint>>
  deleteServiceEndpoint: (request: {
    id: string
    requesterId: string
  }) => Promise<CommandResult<ServiceEndpoint>>
  setServiceEndpointLifecycle: (request: {
    id: string
    lifecycle: EndpointLifecycle
    requesterId: string
  }) => Promise<CommandResult<ServiceEndpoint>>
}
