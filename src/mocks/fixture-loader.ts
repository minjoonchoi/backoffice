import { parseDocument } from "yaml"
import { z } from "zod"

import { initialBackofficeState } from "@/mocks/system-fixture"
import {
  accessPolicyAssignmentTargetSchema,
  accessPolicyEffectSchema,
  accessPolicyInputSchema,
  accessPolicyManagementTypeSchema,
  accessPolicyManagementTypes,
  accessPolicyRequestModeSchema,
  accessPolicyAssignmentTargets,
  accessPolicyResourceTypes,
  approvalAssigneeTypes,
  approvalDocumentExecutionSchema,
  approvalDocumentKinds,
  accessPolicyTypeSchema,
  type AccessPolicy,
  type AccessPolicyResource,
} from "@/features/access-policies/model"
import {
  approvalLineInputSchema,
  approvalExecutionSchema,
  approvalExecutionTypeValues,
  approvalAssigneeModeValues,
  approvalTypeValues,
  approvalStepInputSchema,
  approvalTypeSchema,
  requestCategorySchema,
  requestTemplateFieldInputSchema,
} from "@/features/request-templates/model"
import {
  applicationInputSchema,
  employmentStatusValues,
  organizationInputSchema,
  roleInputSchema,
  userInputSchema,
} from "@/features/iam/model"
import {
  httpMethodSchema,
  serviceEndpointFieldInputSchema,
  serviceEndpointInputSchema,
  serviceInputSchema,
} from "@/features/service-catalog/model"
import { credentialRegistrationAttemptSchema } from "@/features/credentials/model"
import { entityStatusSchema } from "@/domain/common"
import {
  userNotificationEventSchema,
  userNotificationTargetTypeValues,
  userNotificationTargetTypeSchema,
  type BackofficeState,
} from "@/application/state/model"
import { uiResourceKeySchema } from "@/features/ui-resources/ui-resource-manifest"

const entityIdSchema = z.uuid()
const fixtureUiResourceKeyType = "ui-resource-key"
const createdAtSchema = z.iso.datetime()
const recordShape = {
  id: entityIdSchema,
  createdAt: createdAtSchema,
}

const organizationSchema = z
  .object({ ...organizationInputSchema.shape, ...recordShape })
  .strict()

const applicationSchema = z
  .object({ ...applicationInputSchema.shape, ...recordShape })
  .strict()

const userSchema = z
  .object({ ...userInputSchema.shape, ...recordShape })
  .strict()
  .refine(
    (user) =>
      user.employmentStatus === employmentStatusValues.resigned ||
      user.organizationIds.length > 0,
    { path: ["organizationIds"] },
  )

const roleSchema = z
  .object({
    ...roleInputSchema.shape,
    ...recordShape,
    userIds: z.array(entityIdSchema).max(1000),
    organizationIds: z.array(entityIdSchema).max(1000),
  })
  .strict()

const approvalStepSchema = approvalStepInputSchema.and(
  z.object({
    id: entityIdSchema,
    order: z.number().int().min(1).max(12),
  }),
)

const requestTemplateFieldSchema = requestTemplateFieldInputSchema.and(
  z.object({
    id: entityIdSchema,
    order: z.number().int().min(1).max(30),
  }),
)

const approvalLineSchema = z
  .object({
    ...recordShape,
    name: z.string().trim().min(2).max(100),
    version: z.number().int().min(1),
    category: requestCategorySchema,
    type: approvalTypeSchema,
    approvalExecution: approvalExecutionSchema,
    status: entityStatusSchema,
    steps: z.array(approvalStepSchema).max(12),
    fields: z.array(requestTemplateFieldSchema).max(30),
  })
  .strict()
  .refine((line) => approvalLineInputSchema.safeParse(line).success, {
    message: "Invalid request template configuration.",
  })

const localAccessPolicyResourceSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal(accessPolicyResourceTypes.endpoint),
      id: entityIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal(accessPolicyResourceTypes.uiResource),
      id: entityIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal(fixtureUiResourceKeyType),
      key: uiResourceKeySchema,
    })
    .strict(),
])

const localAccessPolicySchema = z
  .object({
    ...recordShape,
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().min(2).max(500),
    type: accessPolicyTypeSchema,
    managementType: accessPolicyManagementTypeSchema.default(
      accessPolicyManagementTypes.general,
    ),
    effect: accessPolicyEffectSchema,
    resources: z.array(localAccessPolicyResourceSchema).min(1).max(2000),
    status: entityStatusSchema,
  })
  .strict()
  .refine(
    (policy) =>
      new Set(
        policy.resources.map((resource) =>
          resource.type === fixtureUiResourceKeyType
            ? `${resource.type}:${resource.key}`
            : `${resource.type}:${resource.id}`,
        ),
      ).size === policy.resources.length,
    { path: ["resources"] },
  )

const accessPolicyAssignmentSchema = z
  .object({
    ...recordShape,
    accessPolicyId: entityIdSchema,
    targetType: accessPolicyAssignmentTargetSchema,
    targetId: entityIdSchema,
    expiresAt: z.iso.datetime().nullable(),
  })
  .strict()

const fieldValueSchema = z
  .object({
    fieldId: entityIdSchema,
    value: z.string().max(5000),
  })
  .strict()

const resolvedApprovalStepBaseShape = {
  id: entityIdSchema,
  order: z.number().int().min(1).max(12),
  stage: z.number().int().min(1).max(12),
  kind: z.enum(["request", "approval", "agreement", "reference"]),
  assigneeMode: z.enum([
    "fixed-user",
    "fixed-organization",
    "document-select",
    "requester",
    "request-organization-leader",
    "request-organization",
    "service-owner-organization",
  ]),
}

const approvalDocumentStepProgressShape = {
  status: z.enum(["waiting", "pending", "completed", "rejected"]),
  processedById: entityIdSchema.nullable(),
  processedAt: z.iso.datetime().nullable(),
  comment: z.string().max(1000).nullable(),
}

const approvalDocumentStepSchema = z.discriminatedUnion("assigneeType", [
  z
    .object({
      ...resolvedApprovalStepBaseShape,
      ...approvalDocumentStepProgressShape,
      assigneeType: z.literal("user"),
      assigneeId: entityIdSchema,
    })
    .strict(),
  z
    .object({
      ...resolvedApprovalStepBaseShape,
      ...approvalDocumentStepProgressShape,
      assigneeType: z.literal("organization"),
      assigneeId: entityIdSchema,
    })
    .strict(),
])

const approvalDocumentHistoryEventSchema = z
  .object({
    ...recordShape,
    type: z.enum([
      "draft-saved",
      "submitted",
      "approved",
      "agreed",
      "referenced",
      "rejected",
      "withdrawn",
      "resubmitted",
    ]),
    actorUserId: entityIdSchema.nullable(),
    stepId: entityIdSchema.nullable(),
    comment: z.string().max(1000).nullable(),
  })
  .strict()

const approvalDocumentBaseShape = {
  ...recordShape,
  title: z.string().trim().min(2).max(160),
  organizationId: entityIdSchema,
  requesterId: entityIdSchema,
  approvalLineId: entityIdSchema,
  approvalExecution: approvalDocumentExecutionSchema,
  content: z.string().trim().min(10).max(5000),
  fieldValues: z.array(fieldValueSchema).max(30),
  status: z.enum(["draft", "submitted", "approved", "rejected", "withdrawn"]),
  approvalSteps: z.array(approvalDocumentStepSchema).max(12),
  history: z.array(approvalDocumentHistoryEventSchema).min(1).max(1000),
}

const approvalDocumentSchema = z.union([
  z
    .object({
      ...approvalDocumentBaseShape,
      documentKind: z.literal("general"),
      type: z.literal("access-grant"),
      accessPolicyId: entityIdSchema,
      targetUserId: entityIdSchema,
      requestMode: accessPolicyRequestModeSchema,
      expiresAt: z.iso.datetime(),
    })
    .strict(),
  z
    .object({
      ...approvalDocumentBaseShape,
      documentKind: z.literal("general"),
      type: z.enum(["resource-create", "access-revoke", "resource-dispose"]),
    })
    .strict(),
  z
    .object({
      ...approvalDocumentBaseShape,
      documentKind: z.literal("api-key-issuance"),
      type: z.literal("api-key"),
      applicationId: entityIdSchema,
      serviceId: entityIdSchema,
      endpointIds: z
        .array(entityIdSchema)
        .max(100)
        .refine((values) => new Set(values).size === values.length),
      keyName: z.string().trim().min(2).max(80),
      awsSecretName: z.string().trim().min(1).max(512),
      awsSecretKey: z.string().trim().min(1).max(128),
    })
    .strict(),
  z
    .object({
      ...approvalDocumentBaseShape,
      documentKind: z.literal("api-key-lifecycle"),
      type: z.literal("api-key-replace"),
      apiKeyId: entityIdSchema,
      awsSecretName: z.string().trim().min(1).max(512),
      awsSecretKey: z.string().trim().min(1).max(128),
    })
    .strict(),
  z
    .object({
      ...approvalDocumentBaseShape,
      documentKind: z.literal("api-key-lifecycle"),
      type: z.literal("api-key-dispose"),
      apiKeyId: entityIdSchema,
    })
    .strict(),
])

const notificationSchema = z
  .object({
    ...recordShape,
    userId: entityIdSchema,
    event: userNotificationEventSchema,
    targetType: userNotificationTargetTypeSchema,
    targetId: entityIdSchema,
    readAt: z.iso.datetime().nullable(),
  })
  .strict()

const serviceSchema = z
  .object({
    ...serviceInputSchema.shape,
    ...recordShape,
    status: entityStatusSchema,
  })
  .strict()

const serviceEndpointSchema = z
  .object({
    ...recordShape,
    serviceId: entityIdSchema,
    name: serviceEndpointInputSchema.shape.name,
    method: httpMethodSchema,
    path: serviceEndpointInputSchema.shape.path,
    version: serviceEndpointInputSchema.shape.version,
    lifecycle: serviceEndpointInputSchema.shape.lifecycle,
  })
  .strict()

const serviceEndpointFieldSchema = z
  .object({
    ...serviceEndpointFieldInputSchema.shape,
    ...recordShape,
    endpointId: entityIdSchema,
  })
  .strict()

const apiKeySchema = z
  .object({
    ...recordShape,
    name: z.string().trim().min(2).max(80),
    applicationId: entityIdSchema,
    accessPolicyId: entityIdSchema.nullable(),
    serviceId: entityIdSchema,
    endpointIds: z
      .array(entityIdSchema)
      .max(100)
      .refine((values) => new Set(values).size === values.length),
    approvalDocumentId: entityIdSchema,
    replacesApiKeyId: entityIdSchema.nullable(),
    registeredByUserId: entityIdSchema.nullable(),
    awsSecretName: z.string().trim().min(1).max(512),
    awsSecretKey: z.string().trim().min(1).max(128),
    expiresAt: z.iso.datetime().nullable(),
    nextRotationAt: z.iso.datetime().nullable(),
    usageSystemNames: z.array(z.string().trim().min(2).max(100)).max(50),
    emergencyRevokedAt: z.iso.datetime().nullable(),
    emergencyRevokeReason: z.string().trim().min(10).max(500).nullable(),
    status: entityStatusSchema,
  })
  .strict()

const fixtureSchema = z
  .object({
    version: z.literal(1),
    defaultUserId: entityIdSchema,
    organizations: z.array(organizationSchema).max(1000),
    applications: z.array(applicationSchema).max(5000),
    users: z.array(userSchema).max(5000),
    roles: z.array(roleSchema).max(1000),
    approvalLines: z.array(approvalLineSchema).max(1000),
    accessPolicies: z.array(localAccessPolicySchema).max(5000),
    accessPolicyAssignments: z.array(accessPolicyAssignmentSchema).max(10000),
    approvalDocuments: z.array(approvalDocumentSchema).max(10000),
    notifications: z.array(notificationSchema).max(20000),
    services: z.array(serviceSchema).max(1000),
    serviceEndpoints: z.array(serviceEndpointSchema).max(10000),
    serviceEndpointFields: z.array(serviceEndpointFieldSchema).max(50000),
    credentialLifecycleSettings: z
      .object({
        expirationPeriodDays: z.number().int().min(1).max(3650),
        rotationIntervalDays: z.number().int().min(1).max(365),
        updatedAt: z.iso.datetime(),
        updatedByUserId: entityIdSchema.nullable(),
      })
      .refine(
        (value) => value.rotationIntervalDays < value.expirationPeriodDays,
        { path: ["rotationIntervalDays"] },
      ),
    credentialRegistrationAttempts: z
      .array(credentialRegistrationAttemptSchema)
      .max(20000),
    apiKeys: z.array(apiKeySchema).max(10000),
  })
  .strict()

type FixtureDefinition = z.infer<typeof fixtureSchema>

export type LoadedFixture = Readonly<{
  defaultUserId: string
  state: BackofficeState
}>

function parseFixtureYaml(source: string): unknown {
  const document = parseDocument(source, {
    merge: false,
    uniqueKeys: true,
  })
  if (document.errors.length > 0) {
    throw new SyntaxError(
      document.errors.map((error) => error.message).join("\n"),
    )
  }
  return document.toJS({ maxAliasCount: 0 }) as unknown
}

function resolveLocalAccessPolicies(
  definitions: FixtureDefinition["accessPolicies"],
): AccessPolicy[] {
  const uiResourcesByKey = new Map(
    initialBackofficeState.uiResources.map((resource) => [
      resource.key,
      resource,
    ]),
  )

  return definitions.map((definition) => {
    const resources: AccessPolicyResource[] = definition.resources.map(
      (resource) => {
        if (resource.type !== fixtureUiResourceKeyType) return resource
        const uiResource = uiResourcesByKey.get(resource.key)
        if (!uiResource) {
          throw new Error(`Fixture UI resource key not found: ${resource.key}`)
        }
        return { type: accessPolicyResourceTypes.uiResource, id: uiResource.id }
      },
    )
    const policy: AccessPolicy = {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      type: definition.type,
      managementType: definition.managementType,
      effect: definition.effect,
      resources,
      status: definition.status,
      createdAt: definition.createdAt,
    }
    return policy
  })
}

function assertUniqueIds(
  name: string,
  records: readonly Readonly<{ id: string }>[],
) {
  const ids = records.map((record) => record.id)
  if (new Set(ids).size !== ids.length) {
    throw new Error(`Fixture ${name} contains duplicate IDs.`)
  }
}

function assertReference(
  ids: ReadonlySet<string>,
  id: string,
  reference: string,
) {
  if (!ids.has(id)) {
    throw new Error(`Fixture ${reference} not found: ${id}`)
  }
}

function validateFixtureReferences(
  state: BackofficeState,
  defaultUserId: string,
) {
  const collections = [
    ["organizations", state.organizations],
    ["applications", state.applications],
    ["users", state.users],
    ["roles", state.roles],
    ["request templates", state.approvalLines],
    ["access policies", state.accessPolicies],
    ["access policy assignments", state.accessPolicyAssignments],
    ["approval documents", state.approvalDocuments],
    ["notifications", state.notifications],
    ["services", state.services],
    ["service endpoints", state.serviceEndpoints],
    ["service endpoint fields", state.serviceEndpointFields],
    ["credential registration attempts", state.credentialRegistrationAttempts],
    ["API keys", state.apiKeys],
    ["namespaces", state.namespaces],
    ["UI resources", state.uiResources],
  ] as const
  for (const [name, records] of collections) assertUniqueIds(name, records)
  assertUniqueIds(
    "request template steps",
    state.approvalLines.flatMap((line) => line.steps),
  )
  assertUniqueIds(
    "request template fields",
    state.approvalLines.flatMap((line) => line.fields),
  )

  const organizationIds = new Set(
    state.organizations.map((organization) => organization.id),
  )
  const userIds = new Set(state.users.map((user) => user.id))
  const applicationIds = new Set(
    state.applications.map((application) => application.id),
  )
  const roleIds = new Set(state.roles.map((role) => role.id))
  const approvalLineIds = new Set(state.approvalLines.map((line) => line.id))
  const accessPolicyIds = new Set(
    state.accessPolicies.map((policy) => policy.id),
  )
  const approvalDocumentIds = new Set(
    state.approvalDocuments.map((document) => document.id),
  )
  const serviceIds = new Set(state.services.map((service) => service.id))
  const endpointIds = new Set(
    state.serviceEndpoints.map((endpoint) => endpoint.id),
  )
  const apiKeyIds = new Set(state.apiKeys.map((apiKey) => apiKey.id))
  const uiResourceIds = new Set(
    state.uiResources.map((resource) => resource.id),
  )
  assertReference(userIds, defaultUserId, "default user")
  for (const organization of state.organizations) {
    assertReference(userIds, organization.leaderUserId, "organization leader")
    if (organization.parentId) {
      assertReference(
        organizationIds,
        organization.parentId,
        "parent organization",
      )
    }
    const leader = state.users.find(
      (user) => user.id === organization.leaderUserId,
    )
    if (!leader?.organizationIds.includes(organization.id)) {
      throw new Error(
        `Fixture organization leader is not a member: ${organization.id}`,
      )
    }
  }
  for (const user of state.users) {
    for (const organizationId of user.organizationIds) {
      assertReference(organizationIds, organizationId, "user organization")
    }
  }
  for (const application of state.applications) {
    assertReference(
      organizationIds,
      application.ownerOrganizationId,
      "application owner organization",
    )
  }
  for (const role of state.roles) {
    for (const userId of role.userIds) {
      assertReference(userIds, userId, "role user")
    }
    for (const organizationId of role.organizationIds) {
      assertReference(organizationIds, organizationId, "role organization")
    }
  }
  for (const namespace of state.namespaces) {
    assertReference(roleIds, namespace.managerRoleId, "namespace manager role")
    assertReference(
      accessPolicyIds,
      namespace.managerAccessPolicyId,
      "namespace manager policy",
    )
    if (
      !state.accessPolicyAssignments.some(
        (assignment) =>
          assignment.accessPolicyId === namespace.managerAccessPolicyId &&
          assignment.targetType === accessPolicyAssignmentTargets.role &&
          assignment.targetId === namespace.managerRoleId,
      )
    ) {
      throw new Error(
        `Fixture namespace manager assignment not found: ${namespace.id}`,
      )
    }
  }
  for (const line of state.approvalLines) {
    for (const step of line.steps) {
      if (step.assigneeMode === approvalAssigneeModeValues.fixedUser) {
        assertReference(userIds, step.userId, "request template user")
      }
      if (step.assigneeMode === approvalAssigneeModeValues.fixedOrganization) {
        assertReference(
          organizationIds,
          step.organizationId,
          "request template organization",
        )
      }
    }
  }
  for (const policy of state.accessPolicies) {
    const parsed = accessPolicyInputSchema.safeParse(policy)
    if (!parsed.success) {
      throw new Error(`Fixture access policy is invalid: ${policy.id}`)
    }
    for (const resource of policy.resources) {
      if (resource.type === accessPolicyResourceTypes.endpoint) {
        assertReference(endpointIds, resource.id, "policy endpoint")
      } else {
        assertReference(uiResourceIds, resource.id, "policy UI resource")
      }
    }
  }
  for (const assignment of state.accessPolicyAssignments) {
    assertReference(
      accessPolicyIds,
      assignment.accessPolicyId,
      "assignment policy",
    )
    const targetIds =
      assignment.targetType === accessPolicyAssignmentTargets.user
        ? userIds
        : assignment.targetType === accessPolicyAssignmentTargets.organization
          ? organizationIds
          : assignment.targetType === accessPolicyAssignmentTargets.role
            ? roleIds
            : applicationIds
    assertReference(targetIds, assignment.targetId, "assignment target")
  }
  const grooRequestIds = new Set<string>()
  for (const document of state.approvalDocuments) {
    assertReference(userIds, document.requesterId, "requester")
    assertReference(
      organizationIds,
      document.organizationId,
      "request organization",
    )
    assertReference(
      approvalLineIds,
      document.approvalLineId,
      "request template",
    )
    const requestTemplate = state.approvalLines.find(
      (template) => template.id === document.approvalLineId,
    )
    if (
      requestTemplate?.approvalExecution.type !==
        document.approvalExecution.type ||
      (document.approvalExecution.type === approvalExecutionTypeValues.groo &&
        (requestTemplate.approvalExecution.type !==
          approvalExecutionTypeValues.groo ||
          requestTemplate.approvalExecution.draftDocumentId !==
            document.approvalExecution.draftDocumentId ||
          document.approvalSteps.length > 0 ||
          grooRequestIds.has(document.approvalExecution.requestId))) ||
      (document.approvalExecution.type ===
        approvalExecutionTypeValues.internal &&
        document.approvalSteps.length === 0)
    ) {
      throw new Error(
        `Fixture request approval execution is invalid: ${document.id}`,
      )
    }
    if (document.approvalExecution.type === approvalExecutionTypeValues.groo) {
      grooRequestIds.add(document.approvalExecution.requestId)
    }
    if (
      document.documentKind === approvalDocumentKinds.general &&
      document.type === approvalTypeValues.accessGrant
    ) {
      assertReference(
        accessPolicyIds,
        document.accessPolicyId,
        "request access policy",
      )
    }
    if (document.documentKind === approvalDocumentKinds.apiKeyIssuance) {
      assertReference(
        applicationIds,
        document.applicationId,
        "request application",
      )
      assertReference(serviceIds, document.serviceId, "request service")
      for (const endpointId of document.endpointIds) {
        assertReference(endpointIds, endpointId, "request endpoint")
        if (
          !state.serviceEndpoints.some(
            (endpoint) =>
              endpoint.id === endpointId &&
              endpoint.serviceId === document.serviceId,
          )
        ) {
          throw new Error(
            `Fixture request endpoint does not belong to service: ${document.id}`,
          )
        }
      }
    }
    if (document.documentKind === approvalDocumentKinds.apiKeyLifecycle) {
      assertReference(apiKeyIds, document.apiKeyId, "request API key")
    }
    for (const step of document.approvalSteps) {
      assertReference(
        step.assigneeType === approvalAssigneeTypes.user
          ? userIds
          : organizationIds,
        step.assigneeId,
        "request assignee",
      )
      if (step.processedById) {
        assertReference(userIds, step.processedById, "request processor")
      }
    }
    const documentStepIds = new Set(
      document.approvalSteps.map((step) => step.id),
    )
    for (const event of document.history) {
      if (event.actorUserId) {
        assertReference(userIds, event.actorUserId, "request history actor")
      }
      if (event.stepId && !documentStepIds.has(event.stepId)) {
        throw new Error(
          `Fixture request history step is invalid: ${document.id}`,
        )
      }
    }
  }
  for (const notification of state.notifications) {
    assertReference(userIds, notification.userId, "notification user")
    assertReference(
      notification.targetType ===
        userNotificationTargetTypeValues.approvalDocument
        ? approvalDocumentIds
        : notification.targetType ===
            userNotificationTargetTypeValues.accessPolicy
          ? accessPolicyIds
          : serviceIds,
      notification.targetId,
      "notification target",
    )
  }
  for (const service of state.services) {
    assertReference(
      organizationIds,
      service.ownerOrganizationId,
      "service owner organization",
    )
    assertReference(
      approvalLineIds,
      service.credentialTemplateIds.issuance,
      "issuance request template",
    )
    assertReference(
      approvalLineIds,
      service.credentialTemplateIds.replacement,
      "replacement request template",
    )
    assertReference(
      approvalLineIds,
      service.credentialTemplateIds.disposal,
      "disposal request template",
    )
  }
  for (const endpoint of state.serviceEndpoints) {
    assertReference(serviceIds, endpoint.serviceId, "endpoint service")
  }
  for (const field of state.serviceEndpointFields) {
    assertReference(endpointIds, field.endpointId, "endpoint field")
  }
  for (const apiKey of state.apiKeys) {
    assertReference(applicationIds, apiKey.applicationId, "API key application")
    if (apiKey.accessPolicyId !== null) {
      assertReference(
        accessPolicyIds,
        apiKey.accessPolicyId,
        "API key access policy",
      )
    }
    assertReference(serviceIds, apiKey.serviceId, "API key service")
    for (const endpointId of apiKey.endpointIds) {
      assertReference(endpointIds, endpointId, "API key endpoint")
      if (
        !state.serviceEndpoints.some(
          (endpoint) =>
            endpoint.id === endpointId &&
            endpoint.serviceId === apiKey.serviceId,
        )
      ) {
        throw new Error(
          `Fixture API key endpoint does not belong to service: ${apiKey.id}`,
        )
      }
    }
    assertReference(
      approvalDocumentIds,
      apiKey.approvalDocumentId,
      "API key approval document",
    )
    if (apiKey.replacesApiKeyId) {
      assertReference(apiKeyIds, apiKey.replacesApiKeyId, "replaced API key")
    }
    if (apiKey.registeredByUserId) {
      assertReference(userIds, apiKey.registeredByUserId, "API key registrar")
    }
  }
  for (const attempt of state.credentialRegistrationAttempts) {
    assertReference(
      approvalDocumentIds,
      attempt.approvalDocumentId,
      "credential registration approval document",
    )
    assertReference(
      serviceIds,
      attempt.serviceId,
      "credential registration service",
    )
    assertReference(
      userIds,
      attempt.registeredByUserId,
      "credential registration user",
    )
    if (attempt.apiKeyId) {
      assertReference(
        apiKeyIds,
        attempt.apiKeyId,
        "credential registration API key",
      )
    }
  }
  if (state.credentialLifecycleSettings.updatedByUserId) {
    assertReference(
      userIds,
      state.credentialLifecycleSettings.updatedByUserId,
      "credential lifecycle settings updater",
    )
  }
}

export function loadFixture(source: string): LoadedFixture {
  const definition = fixtureSchema.parse(parseFixtureYaml(source))
  const state: BackofficeState = {
    systemReferences: structuredClone(initialBackofficeState.systemReferences),
    organizations: definition.organizations,
    applications: definition.applications,
    users: definition.users,
    roles: definition.roles,
    approvalLines: definition.approvalLines,
    approvalLineRevisions: [],
    accessPolicies: [
      ...resolveLocalAccessPolicies(definition.accessPolicies),
      ...structuredClone(initialBackofficeState.accessPolicies),
    ],
    accessPolicyAssignments: [
      ...definition.accessPolicyAssignments,
      ...structuredClone(initialBackofficeState.accessPolicyAssignments),
    ],
    approvalDocuments: definition.approvalDocuments,
    notifications: definition.notifications,
    services: definition.services,
    serviceEndpoints: definition.serviceEndpoints,
    serviceEndpointFields: definition.serviceEndpointFields,
    serviceEndpointRevisions: [],
    credentialLifecycleSettings: definition.credentialLifecycleSettings,
    credentialRegistrationAttempts: definition.credentialRegistrationAttempts,
    apiKeys: definition.apiKeys,
    namespaces: structuredClone(initialBackofficeState.namespaces),
    uiResources: structuredClone(initialBackofficeState.uiResources),
    uiResourceSyncHistories: [
      {
        id: "91000000-0000-4000-8000-000000000001",
        namespaceId:
          initialBackofficeState.systemReferences.namespaceIds.backoffice,
        synchronizedAt: "2026-08-11T00:00:00.000Z",
        synchronizedByUserId: definition.defaultUserId,
        grantManagerAccess: true,
        addedCount: initialBackofficeState.uiResources.length,
        updatedCount: 0,
        restoredCount: 0,
        orphanedCount: 0,
        resources: structuredClone(initialBackofficeState.uiResources),
      },
    ],
    auditEvents: [],
  }
  validateFixtureReferences(state, definition.defaultUserId)
  return { defaultUserId: definition.defaultUserId, state }
}
