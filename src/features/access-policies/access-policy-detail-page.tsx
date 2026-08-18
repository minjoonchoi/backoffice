"use client"

import { requestCategoryValues } from "@/features/request-templates/model"
import { approvalTypeValues } from "@/features/request-templates/model"
import { entityStatuses } from "@/domain/common"
import { uiResourceKeys } from "@/config/menu-registry"
import type { ColumnDef } from "@tanstack/react-table"
import { Pencil, ShieldCheck, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { UiResourceLink } from "@/auth/ui-resource-link"
import { RelationshipRemoveAction } from "@/application/ui/relationship-remove-action"
import { ConfirmAction } from "@/components/patterns/confirm-action"
import { EmptyState } from "@/components/patterns/content-state"
import { DataTable } from "@/components/patterns/data-table"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import { PageHeader } from "@/components/patterns/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { snackbar } from "@/components/ui/snackbar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  resolveAccessPolicyAssignmentAffectedUserIds,
  resolveMissingAccessPolicyResources,
} from "@/features/access-policies/access-policy-assignment"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  resolveAccessPolicyResourceGroups,
  resolveAccessPolicyUiResources,
  type AccessPolicyEndpointResource,
  type AccessPolicyResourceGroup,
  type AccessPolicyUiResource,
} from "@/features/access-policies/access-policy-resources"
import { resolveAccessPolicyApprovalLine } from "@/features/access-policies/access-policy-template"
import { useBackoffice } from "@/application/state/provider"
import {
  AccessPolicyEffectBadge,
  ServiceTypeBadge,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"
import { AccessPolicyCloneLink } from "@/features/access-policies/access-policy-tools"
import { isAccessPolicyEffective } from "@/features/access-policies/access-policy-status"
import {
  accessPolicyAssignmentTargets,
  accessPolicyManagementTypes,
  type AccessPolicyAssignment,
} from "@/features/access-policies/model"
import type { BackofficeState } from "@/application/state/model"
import type { BackofficeUiResourceKey } from "@/config/menu-registry"

type IncludedEndpointResource = AccessPolicyEndpointResource & {
  service: AccessPolicyResourceGroup["service"]
}

function AccessPolicyEndpointResourcesTable({
  resourceGroups,
}: {
  resourceGroups: AccessPolicyResourceGroup[]
}) {
  const t = useTranslations("backoffice.approvalDocuments")
  const endpointsT = useTranslations("backoffice.endpoints")
  const common = useTranslations("backoffice.common")
  const resources = useMemo<IncludedEndpointResource[]>(
    () =>
      resourceGroups
        .flatMap(({ service, endpoints }) =>
          endpoints.map((resource) => ({ ...resource, service })),
        )
        .toSorted((left, right) =>
          `${left.service.name} ${left.endpoint.path}`.localeCompare(
            `${right.service.name} ${right.endpoint.path}`,
          ),
        ),
    [resourceGroups],
  )
  const columns = useMemo<ColumnDef<IncludedEndpointResource>[]>(
    () => [
      {
        id: "name",
        header: common("name"),
        size: 180,
        cell: ({ row }) => (
          <UiResourceLink
            resourceKey={uiResourceKeys.serviceEndpoints.detail.key}
            href={`/service-endpoints/${row.original.endpoint.id}`}
          >
            {row.original.endpoint.name}
          </UiResourceLink>
        ),
      },
      {
        id: "scope",
        header: t("service"),
        size: 180,
        cell: ({ row }) => (
          <span className="flex flex-wrap items-center gap-2">
            <UiResourceLink
              resourceKey={uiResourceKeys.services.detail.key}
              href={`/services/${row.original.service.id}`}
            >
              {row.original.service.name}
            </UiResourceLink>
            <ServiceTypeBadge type={row.original.service.type} />
          </span>
        ),
      },
      {
        id: "identifier",
        header: t("resourceIdentifier"),
        size: 260,
        cell: ({ row }) => (
          <span className="flex min-w-0 items-center gap-2">
            <Badge variant="outline">{row.original.endpoint.method}</Badge>
            <code className="text-xs break-all">
              {row.original.endpoint.path}
            </code>
          </span>
        ),
      },
      {
        id: "details",
        header: t("resourceDetails"),
        size: 360,
        cell: ({ row }) => {
          const resource = row.original
          if (resource.fields.length === 0) {
            return (
              <span className="text-sm text-muted-foreground">
                {t("resourceFieldsEmpty")}
              </span>
            )
          }
          return (
            <ul className="grid min-w-[18rem] gap-2">
              {resource.fields.map((field) => (
                <li
                  key={field.id}
                  className="grid gap-1 border-l-2 border-border-subtle pl-2"
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">
                      {endpointsT(`locations.${field.location}`)}
                    </Badge>
                    <code className="text-xs break-all">{field.fieldPath}</code>
                    <Badge variant="secondary">{field.valueType}</Badge>
                    <span className="text-xs text-text-subtle">
                      {endpointsT(
                        field.required
                          ? "requiredParameter"
                          : "optionalParameter",
                      )}
                    </span>
                  </span>
                  <span className="text-xs text-text-subtle">
                    {field.description}
                  </span>
                </li>
              ))}
            </ul>
          )
        },
      },
    ],
    [common, endpointsT, t],
  )

  return (
    <DataTable
      caption={t("includedEndpointResourcesTableCaption")}
      columns={columns}
      data={resources}
      getRowId={(resource) => resource.endpoint.id}
      empty={t("includedEndpointResourcesEmpty")}
      filterLabel={common("search")}
      noResults={common("noResults")}
      filters={[
        {
          id: "name",
          label: common("name"),
          getValue: (resource) => resource.endpoint.name,
        },
        {
          id: "identifier",
          label: t("resourceIdentifier"),
          getValue: (resource) =>
            `${resource.endpoint.method} ${resource.endpoint.path}`,
        },
        {
          id: "scope",
          label: t("service"),
          getValue: (resource) => resource.service.name,
        },
      ]}
    />
  )
}

function AccessPolicyUiResourcesTable({
  uiResources,
}: {
  uiResources: AccessPolicyUiResource[]
}) {
  const t = useTranslations("backoffice.approvalDocuments")
  const common = useTranslations("backoffice.common")
  const columns = useMemo<ColumnDef<AccessPolicyUiResource>[]>(
    () => [
      {
        id: "name",
        header: common("name"),
        cell: ({ row }) => (
          <UiResourceLink
            resourceKey={uiResourceKeys.uiResources.detail.key}
            href={`/ui-resources/${row.original.resource.id}`}
          >
            {row.original.resource.name}
          </UiResourceLink>
        ),
      },
      {
        id: "namespace",
        header: t("resourceNamespace"),
        cell: ({ row }) => (
          <UiResourceLink
            resourceKey={uiResourceKeys.namespaces.detail.key}
            href={`/namespaces/${row.original.namespace.id}`}
          >
            {row.original.namespace.name}
          </UiResourceLink>
        ),
      },
      {
        id: "identifier",
        header: t("resourceIdentifier"),
        cell: ({ row }) => (
          <code className="block text-xs break-all">
            {row.original.resource.key}
          </code>
        ),
      },
      {
        id: "type",
        header: t("uiResourceType"),
        cell: ({ row }) => (
          <Badge variant="secondary">
            {t(`uiResourceTypes.${row.original.resource.type}`)}
          </Badge>
        ),
      },
    ],
    [common, t],
  )

  return (
    <DataTable
      caption={t("includedUiResourcesTableCaption")}
      columns={columns}
      data={uiResources}
      getRowId={({ resource }) => resource.id}
      empty={t("includedUiResourcesEmpty")}
      filterLabel={common("search")}
      noResults={common("noResults")}
      filters={[
        {
          id: "name",
          label: common("name"),
          getValue: ({ resource }) => resource.name,
        },
        {
          id: "identifier",
          label: t("resourceIdentifier"),
          getValue: ({ resource }) => resource.key,
        },
        {
          id: "namespace",
          label: t("resourceNamespace"),
          getValue: ({ namespace }) => namespace.name,
        },
      ]}
    />
  )
}

function AccessPolicyResourcesTabs({
  resourceGroups,
  uiResources,
}: {
  resourceGroups: AccessPolicyResourceGroup[]
  uiResources: AccessPolicyUiResource[]
}) {
  const t = useTranslations("backoffice.approvalDocuments")
  const endpointCount = resourceGroups.reduce(
    (count, group) => count + group.endpoints.length,
    0,
  )
  const defaultTab = endpointCount > 0 ? "endpoint" : "ui-resource"

  return (
    <Tabs defaultValue={defaultTab}>
      <div className="overflow-x-auto">
        <TabsList aria-label={t("includedResourceTypeTabs")}>
          <TabsTrigger value="endpoint">
            {t("resourceTypeLabels.endpoint")}
            <Badge variant="secondary">{endpointCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="ui-resource">
            {t("resourceTypeLabels.ui-resource")}
            <Badge variant="secondary">{uiResources.length}</Badge>
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="endpoint">
        <AccessPolicyEndpointResourcesTable resourceGroups={resourceGroups} />
      </TabsContent>
      <TabsContent value="ui-resource">
        <AccessPolicyUiResourcesTable uiResources={uiResources} />
      </TabsContent>
    </Tabs>
  )
}

type AccessPolicyAssignmentTargetView = Readonly<{
  name: string
  href: string
  resourceKey: BackofficeUiResourceKey
}>

type AccessPolicyAssignmentRow = Readonly<{
  assignment: AccessPolicyAssignment
  target: AccessPolicyAssignmentTargetView
  affectedUserCount: number
  protected: boolean
}>

function resolveAssignmentTarget(
  state: Pick<
    BackofficeState,
    "applications" | "organizations" | "roles" | "users"
  >,
  assignment: AccessPolicyAssignment,
): AccessPolicyAssignmentTargetView {
  if (assignment.targetType === accessPolicyAssignmentTargets.user) {
    const user = state.users.find(
      (candidate) => candidate.id === assignment.targetId,
    )
    if (!user)
      throw new Error(`Policy assignment user not found: ${assignment.id}`)
    return {
      name: user.nickname,
      href: `/users/${user.id}`,
      resourceKey: uiResourceKeys.users.detail.key,
    }
  }
  if (assignment.targetType === accessPolicyAssignmentTargets.organization) {
    const organization = state.organizations.find(
      (candidate) => candidate.id === assignment.targetId,
    )
    if (!organization) {
      throw new Error(
        `Policy assignment organization not found: ${assignment.id}`,
      )
    }
    return {
      name: organization.name,
      href: `/organizations/${organization.id}`,
      resourceKey: uiResourceKeys.organizations.detail.key,
    }
  }
  if (assignment.targetType === accessPolicyAssignmentTargets.role) {
    const role = state.roles.find(
      (candidate) => candidate.id === assignment.targetId,
    )
    if (!role)
      throw new Error(`Policy assignment role not found: ${assignment.id}`)
    return {
      name: role.name,
      href: `/roles/${role.id}`,
      resourceKey: uiResourceKeys.roles.detail.key,
    }
  }
  const application = state.applications.find(
    (candidate) => candidate.id === assignment.targetId,
  )
  if (!application) {
    throw new Error(`Policy assignment application not found: ${assignment.id}`)
  }
  return {
    name: application.name,
    href: `/applications/${application.id}`,
    resourceKey: uiResourceKeys.applications.detail.key,
  }
}

function AccessPolicyAssignmentsCard({
  policyId,
  policyName,
  canRevoke,
}: {
  policyId: string
  policyName: string
  canRevoke: boolean
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.approvalDocuments")
  const common = useTranslations("backoffice.common")
  const labels = useBackofficeLabels()
  const rows = backoffice.accessPolicyAssignments
    .filter((assignment) => assignment.accessPolicyId === policyId)
    .map((assignment): AccessPolicyAssignmentRow => ({
      assignment,
      target: resolveAssignmentTarget(backoffice, assignment),
      affectedUserCount: resolveAccessPolicyAssignmentAffectedUserIds(
        backoffice,
        assignment.id,
      ).length,
      protected: backoffice.namespaces.some(
        (namespace) =>
          namespace.managerRoleId === assignment.targetId &&
          namespace.managerAccessPolicyId === assignment.accessPolicyId,
      ),
    }))

  const columns = useMemo<ColumnDef<AccessPolicyAssignmentRow>[]>(
    () => [
      {
        id: "targetType",
        header: t("assignmentTargetType"),
        size: 130,
        cell: ({ row }) => (
          <Badge variant="secondary">
            {t(`assignmentTargetTypes.${row.original.assignment.targetType}`)}
          </Badge>
        ),
      },
      {
        id: "target",
        header: t("assignmentTarget"),
        size: 220,
        cell: ({ row }) => (
          <UiResourceLink
            resourceKey={row.original.target.resourceKey}
            href={row.original.target.href}
          >
            {row.original.target.name}
          </UiResourceLink>
        ),
      },
      {
        id: "expiresAt",
        header: t("assignmentExpiresAt"),
        size: 180,
        cell: ({ row }) =>
          row.original.assignment.expiresAt
            ? labels.dateTime(row.original.assignment.expiresAt)
            : t("assignmentNoExpiration"),
      },
      {
        id: "affectedUsers",
        header: t("revokeAffectedUsers"),
        size: 150,
        cell: ({ row }) =>
          t("affectedUserCount", { count: row.original.affectedUserCount }),
      },
      {
        id: "createdAt",
        header: common("createdAt"),
        size: 180,
        cell: ({ row }) => labels.dateTime(row.original.assignment.createdAt),
      },
      ...(canRevoke
        ? [
            {
              id: "actions",
              header: common("actions"),
              size: 100,
              cell: ({ row }) => (
                <span
                  data-ui-resource={
                    uiResourceKeys.approvalDocuments.detail.actions
                      .revokePolicyAssignment
                  }
                >
                  <RelationshipRemoveAction
                    subjectName={policyName}
                    targetName={row.original.target.name}
                    impactDescription={
                      row.original.protected
                        ? t("protectedPolicyAssignment")
                        : t("policyRevokeImpact", {
                            count: row.original.affectedUserCount,
                          })
                    }
                    confirmDisabled={row.original.protected}
                    onRemove={() =>
                      backoffice.unassignAccessPolicyFromTarget(
                        row.original.assignment.id,
                        sessionAccess.currentUser?.id ?? "",
                      )
                    }
                  />
                </span>
              ),
            } satisfies ColumnDef<AccessPolicyAssignmentRow>,
          ]
        : []),
    ],
    [
      backoffice,
      canRevoke,
      common,
      labels,
      policyName,
      sessionAccess.currentUser?.id,
      t,
    ],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("assignmentTargetsTitle")}</CardTitle>
        <CardDescription>{t("assignmentTargetsDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          caption={t("assignmentTargetsTitle")}
          columns={columns}
          data={rows}
          getRowId={(row) => row.assignment.id}
          empty={t("assignmentTargetsEmpty")}
          filterLabel={common("search")}
          noResults={common("noResults")}
          filters={[
            {
              id: "target",
              label: t("assignmentTarget"),
              getValue: (row) => row.target.name,
            },
            {
              id: "type",
              label: t("assignmentTargetType"),
              getValue: (row) =>
                t(`assignmentTargetTypes.${row.assignment.targetType}`),
            },
          ]}
        />
      </CardContent>
    </Card>
  )
}

export function AccessPolicyDetailPage({ policyId }: { policyId: string }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const t = useTranslations("backoffice.approvalDocuments")
  const common = useTranslations("backoffice.common")
  const errorsT = useTranslations("backoffice.errors")
  const policy = backoffice.accessPolicies.find((item) => item.id === policyId)

  if (!policy) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          sessionAccess.canAccessUiResource(
            uiResourceKeys.approvalDocuments.list.key,
          ) ? (
            <Button
              nativeButton={false}
              render={<Link href="/approval-documents" />}
            >
              {common("backToList")}
            </Button>
          ) : undefined
        }
      />
    )
  }

  const approvalLine = resolveAccessPolicyApprovalLine(backoffice, policy.type)
  const resourceGroups = resolveAccessPolicyResourceGroups(backoffice, policy)
  const uiResources = resolveAccessPolicyUiResources(backoffice, policy)
  const canRequest =
    isAccessPolicyEffective(policy) &&
    approvalLine.status === entityStatuses.active &&
    approvalLine.category === requestCategoryValues.permission &&
    approvalLine.type === approvalTypeValues.accessGrant
  const canOpenRequestPage = sessionAccess.canAccessUiResource(
    uiResourceKeys.approvalDocuments.request.key,
  )
  const missingResources = sessionAccess.currentUser
    ? resolveMissingAccessPolicyResources(
        backoffice,
        sessionAccess.currentUser.id,
        policy,
      )
    : policy.resources
  const isAssigned = missingResources.length === 0
  const canUpdate =
    policy.managementType === accessPolicyManagementTypes.general &&
    policy.status === entityStatuses.active &&
    sessionAccess.canAccessUiResource(
      uiResourceKeys.approvalDocuments.detail.actions.updatePolicy,
    ) &&
    sessionAccess.canAccessUiResource(
      uiResourceKeys.approvalDocuments.update.key,
    )
  const canDelete =
    policy.managementType === accessPolicyManagementTypes.general &&
    policy.status === entityStatuses.active &&
    sessionAccess.canAccessUiResource(
      uiResourceKeys.approvalDocuments.detail.actions.deletePolicy,
    )
  const canClone =
    policy.managementType === accessPolicyManagementTypes.general &&
    sessionAccess.canAccessUiResource(
      uiResourceKeys.approvalDocuments.detail.actions.clonePolicy,
    ) &&
    sessionAccess.canAccessUiResource(
      uiResourceKeys.approvalDocuments.create.key,
    ) &&
    sessionAccess.canAccessUiResource(
      uiResourceKeys.approvalDocuments.list.actions.createPolicy,
    )
  const canRevokeAssignment = sessionAccess.canAccessUiResource(
    uiResourceKeys.approvalDocuments.detail.actions.revokePolicyAssignment,
  )
  const assignmentCount = backoffice.accessPolicyAssignments.filter(
    (assignment) => assignment.accessPolicyId === policy.id,
  ).length

  async function deletePolicy() {
    if (!sessionAccess.currentUser) return
    const result = await backoffice.deleteAccessPolicy(
      policyId,
      sessionAccess.currentUser.id,
    )
    if (!result.ok) {
      snackbar.error(errorsT(result.error))
      return
    }
    snackbar.success(t("policyDeleted"))
    router.push("/approval-documents")
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={policy.name}
        description={t("detailDescription")}
        actions={
          <div className="flex flex-wrap gap-2">
            {policy.managementType ===
            accessPolicyManagementTypes.system ? null : canRequest &&
              canOpenRequestPage ? (
              <Button
                nativeButton={false}
                render={
                  <Link href={`/approval-documents/${policy.id}/request`} />
                }
              >
                <ShieldCheck />
                {t("requestFromDetail")}
              </Button>
            ) : (
              <Button disabled>{t("requestFromDetail")}</Button>
            )}
            {canClone ? <AccessPolicyCloneLink policy={policy} /> : null}
            {canUpdate ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={`/approval-documents/${policy.id}/edit`} />}
              >
                <Pencil />
                {t("updatePolicy")}
              </Button>
            ) : null}
            {canDelete ? (
              <ConfirmAction
                trigger={
                  <>
                    <Trash2 />
                    {t("deletePolicy")}
                  </>
                }
                title={t("deletePolicyTitle")}
                description={t(
                  assignmentCount > 0
                    ? "deleteAssignedPolicyDescription"
                    : "deletePolicyDescription",
                )}
                confirmLabel={t("deletePolicy")}
                cancelLabel={common("cancel")}
                onConfirm={deletePolicy}
              />
            ) : null}
          </div>
        }
      />
      {assignmentCount > 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("assignedPolicyNotice", { count: assignmentCount })}
        </p>
      ) : null}
      {!isAssigned && missingResources.length < policy.resources.length ? (
        <p className="rounded-card border border-warning-foreground/30 bg-warning p-3 text-sm text-warning-foreground">
          {t("partialOwnershipNotice", {
            owned: policy.resources.length - missingResources.length,
            missing: missingResources.length,
          })}
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{t("detailTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailItem label={t("effect")}>
              <AccessPolicyEffectBadge effect={policy.effect} />
            </DetailItem>
            <DetailItem label={t("managementType")}>
              <Badge
                variant={
                  policy.managementType === accessPolicyManagementTypes.system
                    ? "info"
                    : "outline"
                }
              >
                {t(`managementTypes.${policy.managementType}`)}
              </Badge>
            </DetailItem>
            <DetailItem label={t("policyDescription")}>
              {policy.description}
            </DetailItem>
            <DetailItem label={common("status")}>
              <Badge
                variant={
                  isAccessPolicyEffective(policy)
                    ? "success"
                    : policy.status === entityStatuses.inactive
                      ? "secondary"
                      : "warning"
                }
              >
                {policy.status === entityStatuses.inactive
                  ? common("inactive")
                  : isAccessPolicyEffective(policy)
                    ? common("active")
                    : t("expired")}
              </Badge>
            </DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>
      <AccessPolicyAssignmentsCard
        policyId={policy.id}
        policyName={policy.name}
        canRevoke={canRevokeAssignment}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("resources")}</CardTitle>
          <CardDescription>{t("resourcesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AccessPolicyResourcesTabs
            resourceGroups={resourceGroups}
            uiResources={uiResources}
          />
        </CardContent>
      </Card>
    </div>
  )
}
