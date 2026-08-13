import { parseDocument } from "yaml"
import { z } from "zod"

import { initialBackofficeState } from "@/mocks/system-fixture"
import {
  accessPolicyAssignmentTargetSchema,
  accessPolicyEffectSchema,
  accessPolicyInputSchema,
  accessPolicyTypeSchema,
  type AccessPolicy,
  type AccessPolicyResource,
} from "@/features/access-policies/model"
import {
  approvalLineInputSchema,
  approvalStepInputSchema,
  approvalTypeSchema,
  requestCategorySchema,
  requestTemplateFieldInputSchema,
} from "@/features/request-templates/model"
import {
  groupInputSchema,
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
import { entityStatusSchema } from "@/domain/common"
import {
  userNotificationEventSchema,
  userNotificationTargetTypeSchema,
  type BackofficeState,
} from "@/application/state/model"
import { uiResourceKeySchema } from "@/features/ui-resources/ui-resource-manifest"

const entityIdSchema = z.uuid()
const createdAtSchema = z.iso.datetime()
const recordShape = {
  id: entityIdSchema,
  createdAt: createdAtSchema,
}

const organizationSchema = z
  .object({ ...organizationInputSchema.shape, ...recordShape })
  .strict()

const userSchema = z
  .object({ ...userInputSchema.shape, ...recordShape })
  .strict()
  .refine(
    (user) =>
      user.employmentStatus === "resigned" || user.organizationIds.length > 0,
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

const groupSchema = z
  .object({
    ...groupInputSchema.shape,
    ...recordShape,
    userIds: z.array(entityIdSchema).max(1000),
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
    category: requestCategorySchema,
    type: approvalTypeSchema,
    status: entityStatusSchema,
    steps: z.array(approvalStepSchema).min(1).max(12),
    fields: z.array(requestTemplateFieldSchema).max(30),
  })
  .strict()
  .refine((line) => approvalLineInputSchema.safeParse(line).success, {
    message: "Invalid request template configuration.",
  })

const localAccessPolicyResourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("endpoint"), id: entityIdSchema }).strict(),
  z.object({ type: z.literal("ui-namespace"), id: entityIdSchema }).strict(),
  z.object({ type: z.literal("ui-resource"), id: entityIdSchema }).strict(),
  z
    .object({
      type: z.literal("ui-resource-key"),
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
    effect: accessPolicyEffectSchema,
    resources: z.array(localAccessPolicyResourceSchema).min(1).max(2000),
    status: entityStatusSchema,
  })
  .strict()
  .refine(
    (policy) =>
      new Set(
        policy.resources.map((resource) =>
          resource.type === "ui-resource-key"
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

const resolvedApprovalStepSchema = z.discriminatedUnion("assigneeType", [
  z
    .object({
      ...resolvedApprovalStepBaseShape,
      assigneeType: z.literal("user"),
      assigneeId: entityIdSchema,
    })
    .strict(),
  z
    .object({
      ...resolvedApprovalStepBaseShape,
      assigneeType: z.literal("organization"),
      assigneeId: entityIdSchema,
    })
    .strict(),
])

const approvalDocumentBaseShape = {
  ...recordShape,
  title: z.string().trim().min(2).max(160),
  organizationId: entityIdSchema,
  requesterId: entityIdSchema,
  approvalLineId: entityIdSchema,
  content: z.string().trim().min(10).max(5000),
  fieldValues: z.array(fieldValueSchema).max(30),
  status: z.enum(["draft", "submitted", "approved"]),
  approvalSteps: z.array(resolvedApprovalStepSchema).min(1).max(12),
}

const approvalDocumentSchema = z.union([
  z
    .object({
      ...approvalDocumentBaseShape,
      documentKind: z.literal("general"),
      type: z.literal("access-grant"),
      accessPolicyId: entityIdSchema,
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
    status: entityStatusSchema,
  })
  .strict()

const fixtureSchema = z
  .object({
    version: z.literal(1),
    defaultUserId: entityIdSchema,
    organizations: z.array(organizationSchema).max(1000),
    users: z.array(userSchema).max(5000),
    roles: z.array(roleSchema).max(1000),
    groups: z.array(groupSchema).max(1000),
    approvalLines: z.array(approvalLineSchema).max(1000),
    accessPolicies: z.array(localAccessPolicySchema).max(5000),
    accessPolicyAssignments: z.array(accessPolicyAssignmentSchema).max(10000),
    approvalDocuments: z.array(approvalDocumentSchema).max(10000),
    notifications: z.array(notificationSchema).max(20000),
    services: z.array(serviceSchema).max(1000),
    serviceEndpoints: z.array(serviceEndpointSchema).max(10000),
    serviceEndpointFields: z.array(serviceEndpointFieldSchema).max(50000),
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
        if (resource.type !== "ui-resource-key") return resource
        const uiResource = uiResourcesByKey.get(resource.key)
        if (!uiResource) {
          throw new Error(`Fixture UI resource key not found: ${resource.key}`)
        }
        return { type: "ui-resource", id: uiResource.id }
      },
    )
    const policy: AccessPolicy = {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      type: definition.type,
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
    ["users", state.users],
    ["roles", state.roles],
    ["groups", state.groups],
    ["request templates", state.approvalLines],
    ["access policies", state.accessPolicies],
    ["access policy assignments", state.accessPolicyAssignments],
    ["approval documents", state.approvalDocuments],
    ["notifications", state.notifications],
    ["services", state.services],
    ["service endpoints", state.serviceEndpoints],
    ["service endpoint fields", state.serviceEndpointFields],
    ["API keys", state.apiKeys],
    ["UI namespaces", state.uiNamespaces],
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
  const roleIds = new Set(state.roles.map((role) => role.id))
  const groupIds = new Set(state.groups.map((group) => group.id))
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
  const uiNamespaceIds = new Set(
    state.uiNamespaces.map((namespace) => namespace.id),
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
  for (const role of state.roles) {
    for (const userId of role.userIds) {
      assertReference(userIds, userId, "role user")
    }
    for (const organizationId of role.organizationIds) {
      assertReference(organizationIds, organizationId, "role organization")
    }
  }
  for (const group of state.groups) {
    for (const userId of group.userIds) {
      assertReference(userIds, userId, "group user")
    }
  }
  for (const namespace of state.uiNamespaces) {
    assertReference(
      roleIds,
      namespace.administratorRoleId,
      "UI namespace administrator role",
    )
    assertReference(
      accessPolicyIds,
      namespace.administratorAccessPolicyId,
      "UI namespace administrator policy",
    )
    if (
      !state.accessPolicyAssignments.some(
        (assignment) =>
          assignment.accessPolicyId === namespace.administratorAccessPolicyId &&
          assignment.targetType === "role" &&
          assignment.targetId === namespace.administratorRoleId,
      )
    ) {
      throw new Error(
        `Fixture UI namespace administrator assignment not found: ${namespace.id}`,
      )
    }
  }
  for (const line of state.approvalLines) {
    for (const step of line.steps) {
      if (step.assigneeMode === "fixed-user") {
        assertReference(userIds, step.userId, "request template user")
      }
      if (step.assigneeMode === "fixed-organization") {
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
      if (resource.type === "endpoint") {
        assertReference(endpointIds, resource.id, "policy endpoint")
      } else if (resource.type === "ui-namespace") {
        assertReference(uiNamespaceIds, resource.id, "policy UI namespace")
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
      assignment.targetType === "user"
        ? userIds
        : assignment.targetType === "organization"
          ? organizationIds
          : assignment.targetType === "role"
            ? roleIds
            : groupIds
    assertReference(targetIds, assignment.targetId, "assignment target")
  }
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
    if (
      document.documentKind === "general" &&
      document.type === "access-grant"
    ) {
      assertReference(
        accessPolicyIds,
        document.accessPolicyId,
        "request access policy",
      )
    }
    if (document.documentKind === "api-key-issuance") {
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
    if (document.documentKind === "api-key-lifecycle") {
      assertReference(apiKeyIds, document.apiKeyId, "request API key")
    }
    for (const step of document.approvalSteps) {
      assertReference(
        step.assigneeType === "user" ? userIds : organizationIds,
        step.assigneeId,
        "request assignee",
      )
    }
  }
  for (const notification of state.notifications) {
    assertReference(userIds, notification.userId, "notification user")
    assertReference(
      notification.targetType === "approval-document"
        ? approvalDocumentIds
        : accessPolicyIds,
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
}

export function loadFixture(source: string): LoadedFixture {
  const definition = fixtureSchema.parse(parseFixtureYaml(source))
  const state: BackofficeState = {
    systemReferences: structuredClone(initialBackofficeState.systemReferences),
    organizations: definition.organizations,
    users: definition.users,
    roles: definition.roles,
    groups: definition.groups,
    approvalLines: definition.approvalLines,
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
    apiKeys: definition.apiKeys,
    uiNamespaces: structuredClone(initialBackofficeState.uiNamespaces),
    uiResources: structuredClone(initialBackofficeState.uiResources),
  }
  validateFixtureReferences(state, definition.defaultUserId)
  return { defaultUserId: definition.defaultUserId, state }
}
