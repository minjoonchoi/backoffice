"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { GitBranch, ShieldCheck, Trash2, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { useBackoffice } from "@/application/state/provider"
import { AccessPolicyReferenceTable } from "@/application/ui/access-policy-reference-table"
import {
  StatusBadge,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"
import { resolveUiResourceAccess } from "@/auth/ui-resource-access"
import { UiResourceLink } from "@/auth/ui-resource-link"
import { useSessionAccess } from "@/auth/session-access-provider"
import { ConfirmAction } from "@/components/patterns/confirm-action"
import { EmptyState } from "@/components/patterns/content-state"
import { DataTable } from "@/components/patterns/data-table"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import { MetricCard } from "@/components/patterns/metric-card"
import { PageHeader } from "@/components/patterns/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { snackbar } from "@/components/ui/snackbar"
import { uiResourceKeys } from "@/config/menu-registry"
import { accessPolicyResourceTypes } from "@/features/access-policies/model"
import type { UiResource } from "@/features/ui-resources/model"
import { UiResourceTypeBadge } from "@/features/ui-resources/ui-resource-page"
import {
  resolveUiResourceVisibilities,
  uiResourceVisibilityValues,
} from "@/features/ui-resources/ui-resource-visibility"

export function UiResourceDetailPage({
  uiResourceId,
}: {
  uiResourceId: string
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const t = useTranslations("backoffice.uiResources")
  const common = useTranslations("backoffice.common")
  const errors = useTranslations("backoffice.errors")
  const labels = useBackofficeLabels()
  const manageableNamespaceIds = new Set(
    sessionAccess.currentUser
      ? resolveUiResourceAccess(backoffice, sessionAccess.currentUser.id)
          .manageableNamespaceIds
      : [],
  )
  const resource = backoffice.uiResources.find(
    (candidate) =>
      candidate.id === uiResourceId &&
      manageableNamespaceIds.has(candidate.namespaceId),
  )

  if (!resource) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          <Button nativeButton={false} render={<Link href="/ui-resources" />}>
            {common("backToList")}
          </Button>
        }
      />
    )
  }
  const selectedResource = resource

  const namespace = backoffice.namespaces.find(
    (candidate) => candidate.id === resource.namespaceId,
  )
  if (!namespace) {
    throw new Error(`UI resource namespace not found: ${resource.id}`)
  }
  const namespaceResources = backoffice.uiResources.filter(
    (candidate) => candidate.namespaceId === resource.namespaceId,
  )
  const visibility =
    resolveUiResourceVisibilities(namespaceResources).get(resource.id) ??
    uiResourceVisibilityValues.ancestorInactive
  const parent = resource.parentKey
    ? namespaceResources.find(
        (candidate) => candidate.key === resource.parentKey,
      )
    : undefined
  const children = namespaceResources.filter(
    (candidate) => candidate.parentKey === resource.key,
  )
  const referencedPolicyIds = backoffice.accessPolicies
    .filter((policy) =>
      policy.resources.some(
        (reference) =>
          reference.type === accessPolicyResourceTypes.uiResource &&
          reference.id === resource.id,
      ),
    )
    .map((policy) => policy.id)
  const canDelete = sessionAccess.canAccessUiResource(
    uiResourceKeys.uiResources.detail.actions.deleteUiResource,
  )
  const deleteBlockers: string[] = []
  if (resource.orphanedAt === null) {
    deleteBlockers.push(t("deleteImpactActiveResource"))
  }
  if (referencedPolicyIds.length > 0) {
    deleteBlockers.push(
      t("deleteImpactReferencedPolicy", {
        count: referencedPolicyIds.length,
      }),
    )
  }
  if (children.length > 0) {
    deleteBlockers.push(
      t("deleteImpactChildResource", { count: children.length }),
    )
  }
  const canConfirmDelete = canDelete && deleteBlockers.length === 0

  async function remove() {
    const requesterId = sessionAccess.currentUser?.id
    if (!requesterId) return
    const result = await backoffice.deleteOrphanedUiResources(
      [selectedResource.id],
      requesterId,
    )
    if (!result.ok) {
      snackbar.error(errors(result.error))
      return
    }
    snackbar.success(t("resourceDeleted", { name: selectedResource.name }))
    router.push("/ui-resources")
  }

  const childColumns: ColumnDef<UiResource>[] = [
    {
      accessorKey: "name",
      header: common("name"),
      size: 200,
    },
    {
      accessorKey: "key",
      header: t("key"),
      size: 300,
      cell: ({ row }) => (
        <code className="text-xs break-all">{row.original.key}</code>
      ),
    },
    {
      accessorKey: "type",
      header: t("type"),
      size: 120,
      cell: ({ row }) => <UiResourceTypeBadge type={row.original.type} />,
    },
    {
      accessorKey: "status",
      header: common("status"),
      size: 120,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={resource.name}
        description={resource.description}
        actions={
          canDelete ? (
            <span
              data-ui-resource={
                uiResourceKeys.uiResources.detail.actions.deleteUiResource
              }
            >
              <ConfirmAction
                trigger={
                  <>
                    <Trash2 aria-hidden="true" />
                    {common("delete")}
                  </>
                }
                {...(deleteBlockers[0]
                  ? { triggerTitle: deleteBlockers[0] }
                  : {})}
                disabled={!canConfirmDelete}
                title={t("deleteResourceTitle", { name: resource.name })}
                description={t("deleteResourceDescription", {
                  name: resource.name,
                })}
                confirmLabel={common("delete")}
                cancelLabel={common("cancel")}
                onConfirm={remove}
              />
            </span>
          ) : undefined
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={ShieldCheck}
          title={t("referencedPolicyCount")}
          value={referencedPolicyIds.length}
        />
        <MetricCard
          icon={GitBranch}
          title={t("childResourceCount")}
          value={children.length}
        />
        <MetricCard
          icon={TriangleAlert}
          title={t("deletionReadiness")}
          value={deleteBlockers.length}
          description={
            deleteBlockers.length > 0
              ? t("deletionBlocked")
              : t("deletionReady")
          }
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("detailTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailItem label={t("namespace")}>
              <UiResourceLink
                resourceKey={uiResourceKeys.namespaces.detail.key}
                href={`/namespaces/${namespace.id}`}
              >
                {namespace.name}
              </UiResourceLink>
            </DetailItem>
            <DetailItem label={t("key")}>
              <code className="break-all">{resource.key}</code>
            </DetailItem>
            <DetailItem label={t("type")}>
              <UiResourceTypeBadge type={resource.type} />
            </DetailItem>
            <DetailItem label={t("visibility")}>
              <Badge
                variant={
                  visibility === uiResourceVisibilityValues.visible
                    ? "success"
                    : visibility === uiResourceVisibilityValues.inactive
                      ? "secondary"
                      : "warning"
                }
              >
                {t(`visibilityStates.${visibility}`)}
              </Badge>
            </DetailItem>
            <DetailItem label={t("parentKey")}>
              {parent ? (
                <UiResourceLink
                  resourceKey={uiResourceKeys.uiResources.detail.key}
                  href={`/ui-resources/${parent.id}`}
                >
                  <code>{parent.key}</code>
                </UiResourceLink>
              ) : (
                t("root")
              )}
            </DetailItem>
            <DetailItem label={t("orphanedAt")}>
              {resource.orphanedAt
                ? labels.dateTime(resource.orphanedAt)
                : t("notOrphaned")}
            </DetailItem>
            <DetailItem label={common("createdAt")}>
              {labels.dateTime(resource.createdAt)}
            </DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("deleteImpactTitle")}</CardTitle>
          <CardDescription>{t("deleteImpactDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant={deleteBlockers.length > 0 ? "warning" : "success"}>
            <AlertTitle>
              {deleteBlockers.length > 0
                ? t("deletionBlocked")
                : t("deletionReady")}
            </AlertTitle>
            <AlertDescription>
              {deleteBlockers.length > 0 ? (
                <ul className="grid list-disc gap-1 pl-5">
                  {deleteBlockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              ) : (
                t("deleteImpactReadyDescription")
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("referencedPolicies")}</CardTitle>
          <CardDescription>
            {t("referencedPoliciesDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccessPolicyReferenceTable
            policyIds={referencedPolicyIds}
            caption={t("referencedPolicies")}
            empty={t("referencedPoliciesEmpty")}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("childResources")}</CardTitle>
          <CardDescription>{t("childResourcesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            caption={t("childResources")}
            columns={childColumns}
            data={children}
            getRowId={(child) => child.id}
            getRowHref={(child) => `/ui-resources/${child.id}`}
            getRowLabel={(child) => `${child.name} ${common("details")}`}
            empty={t("childResourcesEmpty")}
          />
        </CardContent>
      </Card>
    </div>
  )
}
