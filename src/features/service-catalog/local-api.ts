import type { ServiceCatalogApi } from "@/features/service-catalog/api"
import type { BackofficeStateUpdater } from "@/application/api/local-state"
import {
  createEntityBase,
  createRecordBase,
} from "@/application/api/local-state"
import type { BackofficeState } from "@/application/state/model"
import type { ApprovalLine } from "@/features/request-templates/model"
import {
  serviceEndpointInputSchema,
  serviceInputSchema,
  type ServiceEndpointField,
  type ServiceEndpointFieldInput,
} from "@/features/service-catalog/model"

function credentialTemplatesMatch(
  input: {
    credentialTemplateIds: BackofficeState["services"][number]["credentialTemplateIds"]
  },
  approvalLines: ApprovalLine[],
) {
  const templates = [
    [input.credentialTemplateIds.issuance, "api-key"],
    [input.credentialTemplateIds.replacement, "api-key-replace"],
    [input.credentialTemplateIds.disposal, "api-key-dispose"],
  ] as const
  return templates.every(([id, type]) =>
    approvalLines.some(
      (template) =>
        template.id === id &&
        template.category === "credential" &&
        template.type === type &&
        template.status === "active",
    ),
  )
}

function createEndpointField(
  endpointId: string,
  input: ServiceEndpointFieldInput,
): ServiceEndpointField {
  return { ...input, endpointId, ...createRecordBase() }
}

function reconcileEndpointFields(
  endpointId: string,
  currentFields: ServiceEndpointField[],
  inputs: ServiceEndpointFieldInput[],
) {
  return inputs.map((input) => {
    const current = currentFields.find(
      (field) =>
        field.location === input.location &&
        field.fieldPath === input.fieldPath,
    )
    return current
      ? { ...current, ...input }
      : createEndpointField(endpointId, input)
  })
}

export function createLocalServiceCatalogApi(
  state: BackofficeState,
  updateState: BackofficeStateUpdater,
): ServiceCatalogApi {
  return {
    createService: async (input) => {
      await Promise.resolve()
      const parsed = serviceInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (state.services.some((service) => service.code === parsed.data.code)) {
        return { ok: false, error: "service-code-exists" }
      }
      if (
        !state.organizations.some(
          (organization) => organization.id === parsed.data.ownerOrganizationId,
        )
      ) {
        return { ok: false, error: "organization-not-found" }
      }
      if (!credentialTemplatesMatch(parsed.data, state.approvalLines)) {
        return { ok: false, error: "approval-line-not-found" }
      }
      const service = { ...parsed.data, ...createEntityBase() }
      updateState((current) => ({
        ...current,
        services: [...current.services, service],
      }))
      return { ok: true, value: service }
    },

    updateService: async (id, input) => {
      await Promise.resolve()
      const existing = state.services.find((service) => service.id === id)
      if (!existing) return { ok: false, error: "service-not-found" }
      const parsed = serviceInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (
        state.services.some(
          (service) => service.id !== id && service.code === parsed.data.code,
        )
      ) {
        return { ok: false, error: "service-code-exists" }
      }
      if (
        !state.organizations.some(
          (organization) => organization.id === parsed.data.ownerOrganizationId,
        )
      ) {
        return { ok: false, error: "organization-not-found" }
      }
      if (!credentialTemplatesMatch(parsed.data, state.approvalLines)) {
        return { ok: false, error: "approval-line-not-found" }
      }
      if (
        (existing.ownerOrganizationId !== parsed.data.ownerOrganizationId ||
          existing.credentialTemplateIds.issuance !==
            parsed.data.credentialTemplateIds.issuance ||
          existing.credentialTemplateIds.replacement !==
            parsed.data.credentialTemplateIds.replacement ||
          existing.credentialTemplateIds.disposal !==
            parsed.data.credentialTemplateIds.disposal) &&
        (state.apiKeys.some((apiKey) => apiKey.serviceId === id) ||
          state.approvalDocuments.some(
            (document) =>
              document.documentKind === "api-key-issuance" &&
              document.serviceId === id,
          ))
      ) {
        return { ok: false, error: "protected-relationship" }
      }
      if (
        parsed.data.type === "external" &&
        state.serviceEndpoints.some((endpoint) => endpoint.serviceId === id)
      ) {
        return { ok: false, error: "protected-relationship" }
      }
      const service = { ...existing, ...parsed.data }
      updateState((current) => ({
        ...current,
        services: current.services.map((item) =>
          item.id === id ? service : item,
        ),
      }))
      return { ok: true, value: service }
    },

    deleteService: async (id) => {
      await Promise.resolve()
      const existing = state.services.find((service) => service.id === id)
      if (!existing) return { ok: false, error: "service-not-found" }
      if (
        state.serviceEndpoints.some((endpoint) => endpoint.serviceId === id) ||
        state.apiKeys.some((apiKey) => apiKey.serviceId === id) ||
        state.approvalDocuments.some(
          (document) =>
            document.documentKind === "api-key-issuance" &&
            document.serviceId === id,
        )
      ) {
        return { ok: false, error: "protected-relationship" }
      }
      updateState((current) => ({
        ...current,
        services: current.services.filter((service) => service.id !== id),
      }))
      return { ok: true, value: existing }
    },

    createServiceEndpoint: async (input) => {
      await Promise.resolve()
      const parsed = serviceEndpointInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (
        !state.services.some(
          (service) =>
            service.id === parsed.data.serviceId &&
            service.status === "active" &&
            service.type === "internal",
        )
      ) {
        return { ok: false, error: "endpoint-service-invalid" }
      }
      if (
        state.serviceEndpoints.some(
          (endpoint) =>
            endpoint.serviceId === parsed.data.serviceId &&
            endpoint.path === parsed.data.path,
        )
      ) {
        return { ok: false, error: "endpoint-exists" }
      }
      const { fields, ...endpointInput } = parsed.data
      const endpoint = { ...endpointInput, ...createRecordBase() }
      const endpointFields = fields.map((field) =>
        createEndpointField(endpoint.id, field),
      )
      updateState((current) => ({
        ...current,
        serviceEndpoints: [...current.serviceEndpoints, endpoint],
        serviceEndpointFields: [
          ...current.serviceEndpointFields,
          ...endpointFields,
        ],
      }))
      return { ok: true, value: endpoint }
    },

    updateServiceEndpoint: async (id, input) => {
      await Promise.resolve()
      const existing = state.serviceEndpoints.find(
        (endpoint) => endpoint.id === id,
      )
      if (!existing) return { ok: false, error: "endpoint-not-found" }
      const parsed = serviceEndpointInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (
        !state.services.some(
          (service) =>
            service.id === parsed.data.serviceId &&
            service.status === "active" &&
            service.type === "internal",
        )
      ) {
        return { ok: false, error: "endpoint-service-invalid" }
      }
      if (
        state.serviceEndpoints.some(
          (endpoint) =>
            endpoint.id !== id &&
            endpoint.serviceId === parsed.data.serviceId &&
            endpoint.path === parsed.data.path,
        )
      ) {
        return { ok: false, error: "endpoint-exists" }
      }
      const { fields, ...endpointInput } = parsed.data
      const endpoint = { ...existing, ...endpointInput }
      const endpointFields = reconcileEndpointFields(
        id,
        state.serviceEndpointFields.filter((field) => field.endpointId === id),
        fields,
      )
      updateState((current) => ({
        ...current,
        serviceEndpoints: current.serviceEndpoints.map((item) =>
          item.id === id ? endpoint : item,
        ),
        serviceEndpointFields: [
          ...current.serviceEndpointFields.filter(
            (field) => field.endpointId !== id,
          ),
          ...endpointFields,
        ],
      }))
      return { ok: true, value: endpoint }
    },

    deleteServiceEndpoint: async (id) => {
      await Promise.resolve()
      const existing = state.serviceEndpoints.find(
        (endpoint) => endpoint.id === id,
      )
      if (!existing) return { ok: false, error: "endpoint-not-found" }
      if (
        state.accessPolicies.some((policy) =>
          policy.resources.some((resource) => resource.id === id),
        )
      ) {
        return { ok: false, error: "protected-relationship" }
      }
      updateState((current) => ({
        ...current,
        serviceEndpoints: current.serviceEndpoints.filter(
          (endpoint) => endpoint.id !== id,
        ),
        serviceEndpointFields: current.serviceEndpointFields.filter(
          (field) => field.endpointId !== id,
        ),
      }))
      return { ok: true, value: existing }
    },
  }
}
