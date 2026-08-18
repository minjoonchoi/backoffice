import { accessPolicyResourceTypes } from "@/features/access-policies/model"
import type { BackofficeState } from "@/application/state/model"
import { resolveAssignedAccessPolicyIds } from "@/features/access-policies/access-policy-assignment"
import type {
  ServiceEndpoint,
  ServiceEndpointFieldInput,
  ServiceEndpointValue,
} from "@/features/service-catalog/model"

export const endpointSyncKinds = {
  add: "add",
  update: "update",
  delete: "delete",
  unchanged: "unchanged",
} as const
export const endpointSyncBlockedReasons = {
  referencedResource: "referenced-resource",
} as const
export type EndpointSyncKind =
  (typeof endpointSyncKinds)[keyof typeof endpointSyncKinds]

export type EndpointSyncImpact = Readonly<{
  accessPolicyIds: readonly string[]
  credentialIds: readonly string[]
  affectedUserIds: readonly string[]
  addedFieldCount: number
  changedFieldCount: number
  removedFieldCount: number
}>

export type EndpointSyncOperation = Readonly<{
  key: string
  kind: EndpointSyncKind
  current: ServiceEndpoint | null
  next: ServiceEndpointValue | null
  impact: EndpointSyncImpact
  blockedReason:
    | (typeof endpointSyncBlockedReasons)[keyof typeof endpointSyncBlockedReasons]
    | null
}>

export type EndpointSyncPlan = Readonly<{
  serviceId: string
  operations: readonly EndpointSyncOperation[]
}>

type EndpointSyncState = Pick<
  BackofficeState,
  | "accessPolicies"
  | "accessPolicyAssignments"
  | "apiKeys"
  | "approvalDocuments"
  | "organizations"
  | "roles"
  | "serviceEndpointFields"
  | "serviceEndpoints"
  | "services"
  | "users"
>

function endpointIdentity(endpoint: Pick<ServiceEndpointValue, "path">) {
  return endpoint.path
}

function operationKey(kind: EndpointSyncKind, identity: string) {
  return `${kind}:${identity}`
}

function fieldIdentity(
  field: Pick<ServiceEndpointFieldInput, "location" | "fieldPath">,
) {
  return `${field.location}:${field.fieldPath}`
}

function fieldValue(field: ServiceEndpointFieldInput) {
  return [field.valueType, String(field.required), field.description].join(
    "\u0000",
  )
}

function fieldChanges(
  currentFields: readonly ServiceEndpointFieldInput[],
  nextFields: readonly ServiceEndpointFieldInput[],
) {
  const currentByKey = new Map(
    currentFields.map((field) => [fieldIdentity(field), field]),
  )
  const nextByKey = new Map(
    nextFields.map((field) => [fieldIdentity(field), field]),
  )
  return {
    addedFieldCount: nextFields.filter(
      (field) => !currentByKey.has(fieldIdentity(field)),
    ).length,
    changedFieldCount: nextFields.filter((field) => {
      const current = currentByKey.get(fieldIdentity(field))
      return current ? fieldValue(current) !== fieldValue(field) : false
    }).length,
    removedFieldCount: currentFields.filter(
      (field) => !nextByKey.has(fieldIdentity(field)),
    ).length,
  }
}

function endpointChanged(
  current: ServiceEndpoint,
  next: ServiceEndpointValue,
  fields: ReturnType<typeof fieldChanges>,
) {
  return (
    current.name !== next.name ||
    current.version !== next.version ||
    current.lifecycle !== next.lifecycle ||
    fields.addedFieldCount > 0 ||
    fields.changedFieldCount > 0 ||
    fields.removedFieldCount > 0
  )
}

function resolveImpact(
  state: EndpointSyncState,
  serviceId: string,
  endpointId: string | null,
  fields: ReturnType<typeof fieldChanges>,
): EndpointSyncImpact {
  const accessPolicyIds = endpointId
    ? state.accessPolicies
        .filter((policy) =>
          policy.resources.some(
            (resource) =>
              resource.type === accessPolicyResourceTypes.endpoint &&
              resource.id === endpointId,
          ),
        )
        .map((policy) => policy.id)
    : []
  const credentialIds = endpointId
    ? state.apiKeys
        .filter((credential) => credential.endpointIds.includes(endpointId))
        .map((credential) => credential.id)
    : []
  const policyIdSet = new Set(accessPolicyIds)
  const credentialIdSet = new Set(credentialIds)
  const service = state.services.find((candidate) => candidate.id === serviceId)
  const ownerUserIds = service
    ? state.users
        .filter((user) =>
          user.organizationIds.includes(service.ownerOrganizationId),
        )
        .map((user) => user.id)
    : []
  const credentialRequesterIds = state.apiKeys
    .filter((credential) => credentialIdSet.has(credential.id))
    .flatMap((credential) => {
      const request = state.approvalDocuments.find(
        (document) => document.id === credential.approvalDocumentId,
      )
      return request ? [request.requesterId] : []
    })
  const policyUserIds = state.users
    .filter((user) =>
      resolveAssignedAccessPolicyIds(state, user.id).some((policyId) =>
        policyIdSet.has(policyId),
      ),
    )
    .map((user) => user.id)

  return {
    accessPolicyIds,
    credentialIds,
    affectedUserIds: [
      ...new Set([
        ...ownerUserIds,
        ...credentialRequesterIds,
        ...policyUserIds,
      ]),
    ],
    ...fields,
  }
}

export function createEndpointSyncPlan(
  state: EndpointSyncState,
  serviceId: string,
  endpoints: readonly ServiceEndpointValue[],
): EndpointSyncPlan {
  const currentEndpoints = state.serviceEndpoints.filter(
    (endpoint) => endpoint.serviceId === serviceId,
  )
  const currentByIdentity = new Map(
    currentEndpoints.map((endpoint) => [endpointIdentity(endpoint), endpoint]),
  )
  const nextByIdentity = new Map(
    endpoints.map((endpoint) => [endpointIdentity(endpoint), endpoint]),
  )
  const incomingOperations = endpoints.map((next): EndpointSyncOperation => {
    const identity = endpointIdentity(next)
    const current = currentByIdentity.get(identity) ?? null
    const currentFields = current
      ? state.serviceEndpointFields.filter(
          (field) => field.endpointId === current.id,
        )
      : []
    const changes = fieldChanges(currentFields, next.fields)
    const kind = current
      ? endpointChanged(current, next, changes)
        ? "update"
        : "unchanged"
      : "add"
    return {
      key: operationKey(kind, identity),
      kind,
      current,
      next,
      impact: resolveImpact(state, serviceId, current?.id ?? null, changes),
      blockedReason: null,
    }
  })
  const deletionOperations = currentEndpoints
    .filter((endpoint) => !nextByIdentity.has(endpointIdentity(endpoint)))
    .map((current): EndpointSyncOperation => {
      const currentFields = state.serviceEndpointFields.filter(
        (field) => field.endpointId === current.id,
      )
      const changes = fieldChanges(currentFields, [])
      const impact = resolveImpact(state, serviceId, current.id, changes)
      return {
        key: operationKey(endpointSyncKinds.delete, endpointIdentity(current)),
        kind: endpointSyncKinds.delete,
        current,
        next: null,
        impact,
        blockedReason:
          impact.accessPolicyIds.length > 0 || impact.credentialIds.length > 0
            ? endpointSyncBlockedReasons.referencedResource
            : null,
      }
    })

  return {
    serviceId,
    operations: [...incomingOperations, ...deletionOperations].toSorted(
      (a, b) => a.key.localeCompare(b.key),
    ),
  }
}
