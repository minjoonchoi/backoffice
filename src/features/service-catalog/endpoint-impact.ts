import { accessPolicyResourceTypes } from "@/features/access-policies/model"
import type { BackofficeState } from "@/application/state/model"
import type { ServiceEndpointFieldInput } from "@/features/service-catalog/model"

type EndpointImpactState = Pick<
  BackofficeState,
  "accessPolicies" | "apiKeys" | "serviceEndpointFields"
>

export type EndpointChangeImpact = Readonly<{
  addedFields: readonly ServiceEndpointFieldInput[]
  removedFields: readonly ServiceEndpointFieldInput[]
  changedFields: readonly ServiceEndpointFieldInput[]
  accessPolicyIds: readonly string[]
  apiKeyIds: readonly string[]
}>

function fieldKey(
  field: Pick<ServiceEndpointFieldInput, "location" | "fieldPath">,
) {
  return `${field.location}:${field.fieldPath}`
}

export function resolveEndpointChangeImpact(
  state: EndpointImpactState,
  endpointId: string,
  nextFields: readonly ServiceEndpointFieldInput[],
): EndpointChangeImpact {
  const previousFields = state.serviceEndpointFields.filter(
    (field) => field.endpointId === endpointId,
  )
  const previousByKey = new Map(
    previousFields.map((field) => [fieldKey(field), field]),
  )
  const nextByKey = new Map(nextFields.map((field) => [fieldKey(field), field]))
  return {
    addedFields: nextFields.filter(
      (field) => !previousByKey.has(fieldKey(field)),
    ),
    removedFields: previousFields.filter(
      (field) => !nextByKey.has(fieldKey(field)),
    ),
    changedFields: nextFields.filter((field) => {
      const previous = previousByKey.get(fieldKey(field))
      return Boolean(
        previous &&
        (previous.valueType !== field.valueType ||
          previous.required !== field.required ||
          previous.description !== field.description),
      )
    }),
    accessPolicyIds: state.accessPolicies
      .filter((policy) =>
        policy.resources.some(
          (resource) =>
            resource.type === accessPolicyResourceTypes.endpoint &&
            resource.id === endpointId,
        ),
      )
      .map((policy) => policy.id),
    apiKeyIds: state.apiKeys
      .filter((apiKey) => apiKey.endpointIds.includes(endpointId))
      .map((apiKey) => apiKey.id),
  }
}
