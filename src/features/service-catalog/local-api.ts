import { requestCategoryValues } from "@/features/request-templates/model"
import { approvalDocumentKinds } from "@/features/access-policies/model"
import { serviceTypeValues } from "@/features/service-catalog/model"
import { entityStatuses } from "@/domain/common"
import type { ServiceCatalogApi } from "@/features/service-catalog/api"
import { hasUiResourcePolicyAccess } from "@/auth/ui-resource-policy-access"
import {
  resolveServiceResourceAccess,
  canManageService,
} from "@/auth/service-resource-access"
import type { BackofficeStateUpdater } from "@/application/api/local-state"
import {
  createEntityBase,
  createRecordBase,
} from "@/application/api/local-state"
import type { BackofficeState } from "@/application/state/model"
import { entityIdSchema, type CommandResult } from "@/domain/common"
import { uiResourceKeys } from "@/config/menu-registry"
import type { ApprovalLine } from "@/features/request-templates/model"
import {
  serviceEndpointInputSchema,
  endpointLifecycleSchema,
  serviceInputSchema,
  type ServiceEndpointField,
  type ServiceEndpointFieldInput,
  type ServiceEndpointValue,
} from "@/features/service-catalog/model"
import {
  createEndpointSyncPlan,
  endpointSyncKinds,
  type EndpointSyncPlan,
} from "@/features/service-catalog/endpoint-sync"
import type { ServiceEndpointSyncManifestInput } from "@/features/service-catalog/api"

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
        template.category === requestCategoryValues.credential &&
        template.type === type &&
        template.status === entityStatuses.active,
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

type ValidatedEndpointSync = Readonly<{
  plan: EndpointSyncPlan
  endpoints: readonly ServiceEndpointValue[]
}>

function validateEndpointSync(
  state: BackofficeState,
  input: ServiceEndpointSyncManifestInput,
  requesterId: string,
): CommandResult<ValidatedEndpointSync> {
  if (
    !entityIdSchema.safeParse(requesterId).success ||
    !entityIdSchema.safeParse(input.serviceId).success ||
    !hasUiResourcePolicyAccess(
      state,
      requesterId,
      uiResourceKeys.serviceEndpoints.list.actions.syncEndpoints,
    )
  ) {
    return { ok: false, error: "endpoint-sync-forbidden" }
  }
  const service = state.services.find(
    (candidate) =>
      candidate.id === input.serviceId &&
      candidate.status === entityStatuses.active &&
      candidate.type === serviceTypeValues.internal,
  )
  if (!service) return { ok: false, error: "endpoint-service-invalid" }
  if (
    !canManageService(resolveServiceResourceAccess(state, requesterId), service)
  ) {
    return { ok: false, error: "endpoint-sync-forbidden" }
  }
  if (input.endpoints.length === 0 || input.endpoints.length > 500) {
    return { ok: false, error: "invalid-input" }
  }
  const parsed = input.endpoints.map((endpoint) =>
    serviceEndpointInputSchema.safeParse({
      ...endpoint,
      serviceId: input.serviceId,
    }),
  )
  if (parsed.some((result) => !result.success)) {
    return { ok: false, error: "invalid-input" }
  }
  const endpoints = parsed.flatMap((result) =>
    result.success ? [result.data] : [],
  )
  const identities = endpoints.map((endpoint) => endpoint.path)
  if (new Set(identities).size !== identities.length) {
    return { ok: false, error: "invalid-input" }
  }
  return {
    ok: true,
    value: {
      endpoints,
      plan: createEndpointSyncPlan(state, input.serviceId, endpoints),
    },
  }
}

function canManageOrganization(
  state: BackofficeState,
  requesterId: string,
  resourceKey: string,
  organizationId: string,
) {
  return (
    hasUiResourcePolicyAccess(state, requesterId, resourceKey) &&
    resolveServiceResourceAccess(
      state,
      requesterId,
    ).manageableOrganizationIds.includes(organizationId)
  )
}

function canManageServiceWithAction(
  state: BackofficeState,
  requesterId: string,
  resourceKey: string,
  service: BackofficeState["services"][number],
) {
  return (
    hasUiResourcePolicyAccess(state, requesterId, resourceKey) &&
    canManageService(resolveServiceResourceAccess(state, requesterId), service)
  )
}

export function createLocalServiceCatalogApi(
  state: BackofficeState,
  updateState: BackofficeStateUpdater,
): ServiceCatalogApi {
  return {
    createService: async (input, requesterId = "") => {
      await Promise.resolve()
      const parsed = serviceInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (
        !canManageOrganization(
          state,
          requesterId,
          uiResourceKeys.services.list.actions.createService,
          parsed.data.ownerOrganizationId,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      if (state.services.some((service) => service.slug === parsed.data.slug)) {
        return { ok: false, error: "service-slug-exists" }
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

    updateService: async (id, input, requesterId = "") => {
      await Promise.resolve()
      const existing = state.services.find((service) => service.id === id)
      if (!existing) return { ok: false, error: "service-not-found" }
      if (
        !canManageServiceWithAction(
          state,
          requesterId,
          uiResourceKeys.services.detail.actions.updateService,
          existing,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      const parsed = serviceInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      if (
        !resolveServiceResourceAccess(
          state,
          requesterId,
        ).manageableOrganizationIds.includes(parsed.data.ownerOrganizationId)
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      if (parsed.data.slug !== existing.slug) {
        return { ok: false, error: "protected-relationship" }
      }
      if (
        state.services.some(
          (service) => service.id !== id && service.slug === parsed.data.slug,
        )
      ) {
        return { ok: false, error: "service-slug-exists" }
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
              document.documentKind === approvalDocumentKinds.apiKeyIssuance &&
              document.serviceId === id,
          ))
      ) {
        return { ok: false, error: "protected-relationship" }
      }
      if (
        parsed.data.type === serviceTypeValues.external &&
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

    deleteService: async (id, requesterId = "") => {
      await Promise.resolve()
      const existing = state.services.find((service) => service.id === id)
      if (!existing) return { ok: false, error: "service-not-found" }
      if (
        !canManageServiceWithAction(
          state,
          requesterId,
          uiResourceKeys.services.detail.actions.deleteService,
          existing,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      if (
        state.serviceEndpoints.some((endpoint) => endpoint.serviceId === id) ||
        state.apiKeys.some((apiKey) => apiKey.serviceId === id) ||
        state.approvalDocuments.some(
          (document) =>
            document.documentKind === approvalDocumentKinds.apiKeyIssuance &&
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

    createServiceEndpoint: async (input, requesterId = "") => {
      await Promise.resolve()
      const parsed = serviceEndpointInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      const targetService = state.services.find(
        (service) => service.id === parsed.data.serviceId,
      )
      if (
        !targetService ||
        !canManageServiceWithAction(
          state,
          requesterId,
          uiResourceKeys.serviceEndpoints.list.actions.createEndpoint,
          targetService,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      if (
        !state.services.some(
          (service) =>
            service.id === parsed.data.serviceId &&
            service.status === entityStatuses.active &&
            service.type === serviceTypeValues.internal,
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

    analyzeServiceEndpointSync: async (input, requesterId) => {
      await Promise.resolve()
      const validation = validateEndpointSync(state, input, requesterId)
      return validation.ok
        ? { ok: true, value: validation.value.plan }
        : validation
    },

    synchronizeServiceEndpoints: async (
      input,
      selectedOperationKeys,
      requesterId,
    ) => {
      await Promise.resolve()
      const validation = validateEndpointSync(state, input, requesterId)
      if (!validation.ok) return validation
      const selectableOperations = validation.value.plan.operations.filter(
        (operation) => operation.kind !== endpointSyncKinds.unchanged,
      )
      const selectedKeySet = new Set(selectedOperationKeys)
      if (
        selectedKeySet.size === 0 ||
        selectedKeySet.size !== selectedOperationKeys.length ||
        selectedKeySet.size > 500 ||
        [...selectedKeySet].some(
          (key) =>
            !selectableOperations.some((operation) => operation.key === key),
        )
      ) {
        return { ok: false, error: "invalid-input" }
      }
      const selectedOperations = selectableOperations.filter((operation) =>
        selectedKeySet.has(operation.key),
      )
      if (selectedOperations.some((operation) => operation.blockedReason)) {
        return { ok: false, error: "protected-relationship" }
      }

      const addedEndpoints = selectedOperations.flatMap((operation) => {
        if (operation.kind !== endpointSyncKinds.add || !operation.next) {
          return []
        }
        const { fields, ...endpointInput } = operation.next
        const endpoint = { ...endpointInput, ...createRecordBase() }
        return [{ endpoint, fields }]
      })
      const updatedEndpoints = selectedOperations.flatMap((operation) => {
        if (
          operation.kind !== endpointSyncKinds.update ||
          !operation.current ||
          !operation.next
        ) {
          return []
        }
        const { fields, ...endpointInput } = operation.next
        const currentFields = state.serviceEndpointFields.filter(
          (field) => field.endpointId === operation.current?.id,
        )
        return [
          {
            endpoint: { ...operation.current, ...endpointInput },
            fields: reconcileEndpointFields(
              operation.current.id,
              currentFields,
              fields,
            ),
            revision: {
              endpointId: operation.current.id,
              version: operation.current.version,
              endpoint: structuredClone(operation.current),
              fields: structuredClone(currentFields),
              ...createRecordBase(),
            },
          },
        ]
      })
      const deletedEndpointIds = new Set(
        selectedOperations.flatMap((operation) =>
          operation.kind === endpointSyncKinds.delete && operation.current
            ? [operation.current.id]
            : [],
        ),
      )
      const updatedEndpointIds = new Set(
        updatedEndpoints.map(({ endpoint }) => endpoint.id),
      )
      const addedFields = addedEndpoints.flatMap(({ endpoint, fields }) =>
        fields.map((field) => createEndpointField(endpoint.id, field)),
      )
      const updatedFields = updatedEndpoints.flatMap(({ fields }) => fields)

      updateState((current) => ({
        ...current,
        serviceEndpoints: [
          ...current.serviceEndpoints
            .filter((endpoint) => !deletedEndpointIds.has(endpoint.id))
            .map(
              (endpoint) =>
                updatedEndpoints.find(
                  (candidate) => candidate.endpoint.id === endpoint.id,
                )?.endpoint ?? endpoint,
            ),
          ...addedEndpoints.map(({ endpoint }) => endpoint),
        ],
        serviceEndpointFields: [
          ...current.serviceEndpointFields.filter(
            (field) =>
              !deletedEndpointIds.has(field.endpointId) &&
              !updatedEndpointIds.has(field.endpointId),
          ),
          ...updatedFields,
          ...addedFields,
        ],
        serviceEndpointRevisions: [
          ...current.serviceEndpointRevisions.filter(
            (revision) => !deletedEndpointIds.has(revision.endpointId),
          ),
          ...updatedEndpoints.map(({ revision }) => revision),
        ],
      }))

      const affectedUserIds = [
        ...new Set(
          selectedOperations.flatMap(
            (operation) => operation.impact.affectedUserIds,
          ),
        ),
      ]
      queueMicrotask(() => {
        if (affectedUserIds.length === 0) return
        updateState((current) => ({
          ...current,
          notifications: [
            ...current.notifications,
            ...affectedUserIds.map((userId) => ({
              userId,
              event: "service-endpoints-synchronized" as const,
              targetType: "service" as const,
              targetId: input.serviceId,
              readAt: null,
              ...createRecordBase(),
            })),
          ],
        }))
      })
      return {
        ok: true,
        value: {
          addedCount: addedEndpoints.length,
          updatedCount: updatedEndpoints.length,
          deletedCount: deletedEndpointIds.size,
          notifiedUserCount: affectedUserIds.length,
        },
      }
    },

    updateServiceEndpoint: async (id, input, requesterId = "") => {
      await Promise.resolve()
      const existing = state.serviceEndpoints.find(
        (endpoint) => endpoint.id === id,
      )
      if (!existing) return { ok: false, error: "endpoint-not-found" }
      const existingService = state.services.find(
        (service) => service.id === existing.serviceId,
      )
      if (
        !existingService ||
        !canManageServiceWithAction(
          state,
          requesterId,
          uiResourceKeys.serviceEndpoints.detail.actions.updateEndpoint,
          existingService,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      const parsed = serviceEndpointInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "invalid-input" }
      const targetService = state.services.find(
        (service) => service.id === parsed.data.serviceId,
      )
      if (
        !targetService ||
        !canManageService(
          resolveServiceResourceAccess(state, requesterId),
          targetService,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      if (
        !state.services.some(
          (service) =>
            service.id === parsed.data.serviceId &&
            service.status === entityStatuses.active &&
            service.type === serviceTypeValues.internal,
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
      const currentFields = state.serviceEndpointFields.filter(
        (field) => field.endpointId === id,
      )
      const endpointFields = reconcileEndpointFields(id, currentFields, fields)
      const revision = {
        endpointId: id,
        version: existing.version,
        endpoint: structuredClone(existing),
        fields: structuredClone(currentFields),
        ...createRecordBase(),
      }
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
        serviceEndpointRevisions: [
          ...current.serviceEndpointRevisions,
          revision,
        ],
      }))
      return { ok: true, value: endpoint }
    },

    deleteServiceEndpoint: async (id, requesterId = "") => {
      await Promise.resolve()
      const existing = state.serviceEndpoints.find(
        (endpoint) => endpoint.id === id,
      )
      if (!existing) return { ok: false, error: "endpoint-not-found" }
      const service = state.services.find(
        (candidate) => candidate.id === existing.serviceId,
      )
      if (
        !service ||
        !canManageServiceWithAction(
          state,
          requesterId,
          uiResourceKeys.serviceEndpoints.detail.actions.deleteEndpoint,
          service,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
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
        serviceEndpointRevisions: current.serviceEndpointRevisions.filter(
          (revision) => revision.endpointId !== id,
        ),
      }))
      return { ok: true, value: existing }
    },

    setServiceEndpointLifecycle: async (id, lifecycle, requesterId = "") => {
      await Promise.resolve()
      if (
        !entityIdSchema.safeParse(id).success ||
        !endpointLifecycleSchema.safeParse(lifecycle).success
      ) {
        return { ok: false, error: "invalid-input" }
      }
      const existing = state.serviceEndpoints.find(
        (endpoint) => endpoint.id === id,
      )
      if (!existing) return { ok: false, error: "endpoint-not-found" }
      const service = state.services.find(
        (candidate) => candidate.id === existing.serviceId,
      )
      if (
        !service ||
        !canManageServiceWithAction(
          state,
          requesterId,
          uiResourceKeys.serviceEndpoints.detail.actions
            .changeEndpointLifecycle,
          service,
        )
      ) {
        return { ok: false, error: "policy-operation-forbidden" }
      }
      const endpoint = { ...existing, lifecycle }
      updateState((current) => ({
        ...current,
        serviceEndpoints: current.serviceEndpoints.map((item) =>
          item.id === id ? endpoint : item,
        ),
      }))
      return { ok: true, value: endpoint }
    },
  }
}
