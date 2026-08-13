"use client"

import { uiResourceKeys } from "@/config/menu-registry"
import type { ColumnDef } from "@tanstack/react-table"
import { Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { UiResourceLink } from "@/auth/ui-resource-link"
import { ConfirmAction } from "@/components/patterns/confirm-action"
import { EmptyState } from "@/components/patterns/content-state"
import { DataTable } from "@/components/patterns/data-table"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import { PageHeader } from "@/components/patterns/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { snackbar } from "@/components/ui/snackbar"
import { resolveMissingAccessPolicyResources } from "@/features/access-policies/access-policy-assignment"
import { AccessPolicyUpdateDialog } from "@/features/access-policies/access-policy-creation-dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  resolveAccessPolicyResourceGroups,
  resolveAccessPolicyUiNamespaces,
  resolveAccessPolicyUiResources,
  type AccessPolicyUiResource,
} from "@/features/access-policies/access-policy-resources"
import { resolveAccessPolicyApprovalLine } from "@/features/access-policies/access-policy-template"
import { ApprovalDocumentDialog } from "@/features/access-policies/approval-document-dialog"
import { useBackoffice } from "@/application/state/provider"
import {
  AccessPolicyEffectBadge,
  ServiceTypeBadge,
} from "@/application/ui/backoffice-ui"

function AccessPolicyUiResourcesTable({
  resources,
}: {
  resources: AccessPolicyUiResource[]
}) {
  const t = useTranslations("backoffice.approvalDocuments")
  const resourcesT = useTranslations("backoffice.uiResources")
  const common = useTranslations("backoffice.common")
  const columns = useMemo<ColumnDef<AccessPolicyUiResource>[]>(
    () => [
      {
        id: "name",
        header: common("name"),
        size: 180,
        accessorFn: ({ resource }) => resource.name,
      },
      {
        id: "type",
        header: resourcesT("type"),
        size: 100,
        cell: ({ row }) => (
          <Badge variant="outline">
            {t(`uiResourceTypes.${row.original.resource.type}`)}
          </Badge>
        ),
      },
      {
        id: "key",
        header: resourcesT("key"),
        size: 280,
        cell: ({ row }) => (
          <code className="block truncate" title={row.original.resource.key}>
            {row.original.resource.key}
          </code>
        ),
      },
      {
        id: "namespace",
        header: resourcesT("namespace"),
        size: 160,
        accessorFn: ({ namespace }) => namespace.name,
      },
    ],
    [common, resourcesT, t],
  )
  const sortedResources = useMemo(
    () =>
      [...resources].sort((left, right) =>
        left.resource.key.localeCompare(right.resource.key),
      ),
    [resources],
  )

  return (
    <DataTable
      caption={resourcesT("tableCaption")}
      columns={columns}
      data={sortedResources}
      getRowId={({ resource }) => resource.id}
      empty={resourcesT("empty")}
      filterLabel={common("search")}
      noResults={common("noResults")}
      filters={[
        {
          id: "name",
          label: common("name"),
          getValue: ({ resource }) => resource.name,
        },
        {
          id: "key",
          label: resourcesT("key"),
          getValue: ({ resource }) => resource.key,
        },
        {
          id: "type",
          label: resourcesT("type"),
          getValue: ({ resource }) => t(`uiResourceTypes.${resource.type}`),
        },
        {
          id: "namespace",
          label: resourcesT("namespace"),
          getValue: ({ namespace }) => namespace.name,
        },
      ]}
    />
  )
}

export function AccessPolicyDetailPage({ policyId }: { policyId: string }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const t = useTranslations("backoffice.approvalDocuments")
  const linesT = useTranslations("backoffice.approvalLines")
  const endpointsT = useTranslations("backoffice.endpoints")
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
            <Button render={<Link href="/approval-documents" />}>
              {common("backToList")}
            </Button>
          ) : undefined
        }
      />
    )
  }

  const approvalLine = resolveAccessPolicyApprovalLine(backoffice, policy.type)
  const resourceGroups = resolveAccessPolicyResourceGroups(backoffice, policy)
  const uiNamespaces = resolveAccessPolicyUiNamespaces(backoffice, policy)
  const uiResources = resolveAccessPolicyUiResources(backoffice, policy)
  const canRequest =
    policy.status === "active" &&
    approvalLine.status === "active" &&
    approvalLine.category === "permission" &&
    approvalLine.type === "access-grant"
  const missingResources = sessionAccess.currentUser
    ? resolveMissingAccessPolicyResources(
        backoffice,
        sessionAccess.currentUser.id,
        policy,
      )
    : policy.resources
  const isAssigned = missingResources.length === 0
  const canUpdate =
    policy.status === "active" &&
    sessionAccess.canAccessUiResource(
      uiResourceKeys.approvalDocuments.detail.actions.updatePolicy,
    )
  const canDelete =
    policy.status === "active" &&
    sessionAccess.canAccessUiResource(
      uiResourceKeys.approvalDocuments.detail.actions.deletePolicy,
    )
  const canViewEndpointDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.serviceEndpoints.detail.key,
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
            {isAssigned ? null : canRequest ? (
              <ApprovalDocumentDialog
                policy={policy}
                approvalLine={approvalLine}
                triggerLabel={t("requestFromDetail")}
              />
            ) : (
              <Button disabled>{t("requestFromDetail")}</Button>
            )}
            {canUpdate ? <AccessPolicyUpdateDialog policy={policy} /> : null}
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
            <DetailItem label={linesT("title")}>{approvalLine.name}</DetailItem>
            <DetailItem label={t("policyDescription")}>
              {policy.description}
            </DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("resources")}</CardTitle>
          <CardDescription>{t("resourcesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {resourceGroups.map(({ service, endpoints }) => (
              <section
                key={service.id}
                aria-labelledby={`policy-service-${service.id}`}
                className="grid gap-3 rounded-card border border-border-subtle bg-surface-subtle p-4"
              >
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <UiResourceLink
                      resourceKey={uiResourceKeys.services.detail.key}
                      id={`policy-service-${service.id}`}
                      href={`/services/${service.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {service.name}
                    </UiResourceLink>
                    <ServiceTypeBadge type={service.type} />
                    <Badge variant="secondary">
                      {t("endpointCount", { count: endpoints.length })}
                    </Badge>
                  </div>
                  <code className="text-xs break-all text-text-subtle">
                    {service.host}
                  </code>
                </div>
                <ul className="grid gap-3">
                  {endpoints.map(({ endpoint, fields }) => (
                    <li
                      key={endpoint.id}
                      className="grid gap-4 rounded-card border border-border-subtle bg-surface p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="grid min-w-0 gap-1.5">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{endpoint.method}</Badge>
                            <h3 className="font-medium">{endpoint.name}</h3>
                          </div>
                          <code className="text-sm break-all text-text-subtle">
                            {endpoint.path}
                          </code>
                        </div>
                        {canViewEndpointDetail ? (
                          <Button
                            size="sm"
                            variant="outline"
                            nativeButton={false}
                            render={
                              <Link
                                href={`/service-endpoints/${endpoint.id}`}
                                aria-label={t("endpointDetail", {
                                  endpoint: endpoint.name,
                                })}
                              />
                            }
                          >
                            {common("details")}
                          </Button>
                        ) : null}
                      </div>
                      {fields.length > 0 ? (
                        <div className="overflow-x-auto rounded-control border border-border-subtle">
                          <table className="w-full min-w-[40rem] text-left text-sm">
                            <thead className="bg-surface-subtle text-xs text-text-subtle">
                              <tr>
                                <th className="px-3 py-2 font-medium">
                                  {endpointsT("location")}
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  {endpointsT("fieldPath")}
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  {endpointsT("valueType")}
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  {endpointsT("required")}
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  {endpointsT("fieldDescription")}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                              {fields.map((field) => (
                                <tr key={field.id}>
                                  <td className="px-3 py-2">
                                    {endpointsT(`locations.${field.location}`)}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-xs">
                                    {field.fieldPath}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge variant="secondary">
                                      {field.valueType}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2">
                                    {endpointsT(
                                      field.required
                                        ? "requiredParameter"
                                        : "optionalParameter",
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-text-subtle">
                                    {field.description}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t("resourceFieldsEmpty")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {uiNamespaces.length > 0 ? (
              <section className="grid gap-3 rounded-card border border-border-subtle bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">
                    {t("resourceTypeLabels.ui-namespace")}
                  </h3>
                  <Badge variant="secondary">
                    {t("resourceCount", { count: uiNamespaces.length })}
                  </Badge>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {uiNamespaces.map((namespace) => (
                    <li
                      key={namespace.id}
                      className="grid gap-1 rounded-control border border-border-subtle bg-surface-subtle p-3"
                    >
                      <span className="font-medium">{namespace.name}</span>
                      <code className="text-xs text-text-subtle">
                        {namespace.key}
                      </code>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {uiResources.length > 0 ? (
              <section className="grid gap-3 rounded-card border border-border-subtle bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">
                    {t("resourceTypeLabels.ui-resource")}
                  </h3>
                  <Badge variant="secondary">
                    {t("resourceCount", { count: uiResources.length })}
                  </Badge>
                </div>
                <AccessPolicyUiResourcesTable resources={uiResources} />
              </section>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
