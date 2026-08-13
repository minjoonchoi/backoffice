import type { CommandResult } from "@/domain/common"
import type {
  ManagedService,
  ServiceInput,
  ServiceEndpoint,
  ServiceEndpointInput,
} from "@/features/service-catalog/model"

export interface ServiceCatalogApi {
  createService: (input: ServiceInput) => Promise<CommandResult<ManagedService>>
  updateService: (
    id: string,
    input: ServiceInput,
  ) => Promise<CommandResult<ManagedService>>
  deleteService: (id: string) => Promise<CommandResult<ManagedService>>
  createServiceEndpoint: (
    input: ServiceEndpointInput,
  ) => Promise<CommandResult<ServiceEndpoint>>
  updateServiceEndpoint: (
    id: string,
    input: ServiceEndpointInput,
  ) => Promise<CommandResult<ServiceEndpoint>>
  deleteServiceEndpoint: (id: string) => Promise<CommandResult<ServiceEndpoint>>
}

export interface ServiceCatalogApiClient {
  createService: (request: {
    body: ServiceInput
  }) => Promise<CommandResult<ManagedService>>
  updateService: (request: {
    id: string
    body: ServiceInput
  }) => Promise<CommandResult<ManagedService>>
  deleteService: (request: {
    id: string
  }) => Promise<CommandResult<ManagedService>>
  createServiceEndpoint: (request: {
    body: ServiceEndpointInput
  }) => Promise<CommandResult<ServiceEndpoint>>
  updateServiceEndpoint: (request: {
    id: string
    body: ServiceEndpointInput
  }) => Promise<CommandResult<ServiceEndpoint>>
  deleteServiceEndpoint: (request: {
    id: string
  }) => Promise<CommandResult<ServiceEndpoint>>
}
