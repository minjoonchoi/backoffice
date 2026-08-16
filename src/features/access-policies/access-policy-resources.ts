import { accessPolicyResourceTypes } from "@/features/access-policies/model"
import type {
  AccessPolicy,
  AccessPolicyResource,
} from "@/features/access-policies/model"
import type { BackofficeState } from "@/application/state/model"
import type {
  ManagedService,
  ServiceEndpoint,
  ServiceEndpointField,
} from "@/features/service-catalog/model"
import type { Namespace, UiResource } from "@/features/ui-resources/model"

type AccessPolicyResourceState = Pick<
  BackofficeState,
  | "services"
  | "serviceEndpoints"
  | "serviceEndpointFields"
  | "namespaces"
  | "uiResources"
>

export type AccessPolicyEndpointResource = {
  endpoint: ServiceEndpoint
  fields: ServiceEndpointField[]
}

export type AccessPolicyResourceGroup = {
  service: ManagedService
  endpoints: AccessPolicyEndpointResource[]
}

export type AccessPolicyResourceDisplay = Readonly<{
  reference: AccessPolicyResource
  name: string
  scope: string | null
  identifier: string
}>

export function resolveAccessPolicyResourceDisplay(
  state: AccessPolicyResourceState,
  reference: AccessPolicyResource,
): AccessPolicyResourceDisplay {
  if (reference.type === accessPolicyResourceTypes.endpoint) {
    const endpoint = state.serviceEndpoints.find(
      (candidate) => candidate.id === reference.id,
    )
    if (!endpoint) {
      throw new Error(`Access policy endpoint not found: ${reference.id}`)
    }
    const service = state.services.find(
      (candidate) => candidate.id === endpoint.serviceId,
    )
    if (!service) {
      throw new Error(`Access policy service not found: ${endpoint.serviceId}`)
    }
    return {
      reference,
      name: endpoint.name,
      scope: service.name,
      identifier: `${endpoint.method} ${endpoint.path}`,
    }
  }
  const resource = state.uiResources.find(
    (candidate) => candidate.id === reference.id,
  )
  if (!resource) {
    throw new Error(`Access policy UI resource not found: ${reference.id}`)
  }
  const namespace = state.namespaces.find(
    (candidate) => candidate.id === resource.namespaceId,
  )
  if (!namespace) {
    throw new Error(
      `Access policy UI resource namespace not found: ${resource.namespaceId}`,
    )
  }
  return {
    reference,
    name: resource.name,
    scope: namespace.name,
    identifier: resource.key,
  }
}

export function resolveAccessPolicyResourceGroups(
  state: AccessPolicyResourceState,
  policy: AccessPolicy,
): AccessPolicyResourceGroup[] {
  const groups = new Map<string, AccessPolicyResourceGroup>()

  for (const resourceReference of policy.resources) {
    if (resourceReference.type !== accessPolicyResourceTypes.endpoint) continue
    const endpointId = resourceReference.id
    const endpoint = state.serviceEndpoints.find(
      (candidate) => candidate.id === endpointId,
    )
    if (!endpoint) {
      throw new Error(`Access policy endpoint not found: ${endpointId}`)
    }
    const service = state.services.find(
      (candidate) => candidate.id === endpoint.serviceId,
    )
    if (!service) {
      throw new Error(`Access policy service not found: ${endpoint.serviceId}`)
    }
    const resource = {
      endpoint,
      fields: state.serviceEndpointFields.filter(
        (field) => field.endpointId === endpoint.id,
      ),
    }
    const group = groups.get(service.id)
    if (group) {
      group.endpoints.push(resource)
    } else {
      groups.set(service.id, { service, endpoints: [resource] })
    }
  }

  return [...groups.values()]
}

export type AccessPolicyUiResource = {
  namespace: Namespace
  resource: UiResource
}

export function resolveAccessPolicyUiResources(
  state: AccessPolicyResourceState,
  policy: AccessPolicy,
): AccessPolicyUiResource[] {
  return policy.resources.flatMap((reference) => {
    if (reference.type !== accessPolicyResourceTypes.uiResource) return []
    const resource = state.uiResources.find(
      (candidate) => candidate.id === reference.id,
    )
    if (!resource) {
      throw new Error(`Access policy UI resource not found: ${reference.id}`)
    }
    const namespace = state.namespaces.find(
      (candidate) => candidate.id === resource.namespaceId,
    )
    if (!namespace) {
      throw new Error(
        `Access policy UI resource namespace not found: ${resource.namespaceId}`,
      )
    }
    return [{ namespace, resource }]
  })
}

export function accessPolicyResourceNames(
  state: AccessPolicyResourceState,
  policy: AccessPolicy,
) {
  const names = [
    ...resolveAccessPolicyResourceGroups(state, policy).map(
      (group) => group.service.name,
    ),
    ...resolveAccessPolicyUiResources(state, policy).map(
      ({ namespace, resource }) => `${namespace.name} / ${resource.name}`,
    ),
  ]
  return [...new Set(names)].join(", ")
}
