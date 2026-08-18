"use client"

import { entityStatuses } from "@/domain/common"
import type { ColumnDef } from "@tanstack/react-table"
import { AppWindow, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { useBackoffice } from "@/application/state/provider"
import { useBackofficeLabels } from "@/application/ui/backoffice-ui"
import { ConfirmAction } from "@/components/patterns/confirm-action"
import { DataTable } from "@/components/patterns/data-table"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import { EmptyState } from "@/components/patterns/content-state"
import { MetricCard } from "@/components/patterns/metric-card"
import { PageHeader } from "@/components/patterns/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { snackbar } from "@/components/ui/snackbar"
import { uiResourceKeys } from "@/config/menu-registry"
import type { Application } from "@/features/iam/model"
import type { ApiKey } from "@/features/credentials/model"
import { accessPolicyAssignmentTargets } from "@/features/access-policies/model"

export function ApplicationsPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.applications")
  const labels = useBackofficeLabels()
  const canCreate = sessionAccess.canAccessUiResource(
    uiResourceKeys.applications.list.actions.createApplication,
  )
  const canViewDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.applications.detail.key,
  )
  const columns = useMemo<ColumnDef<Application>[]>(
    () => [
      { accessorKey: "name", header: t("name") },
      { accessorKey: "slug", header: t("slug") },
      {
        id: "ownerOrganization",
        header: t("ownerOrganization"),
        cell: ({ row }) =>
          backoffice.organizations.find(
            (organization) =>
              organization.id === row.original.ownerOrganizationId,
          )?.name ?? common("none"),
      },
      { accessorKey: "description", header: t("applicationDescription") },
      {
        accessorKey: "createdAt",
        header: common("createdAt"),
        cell: ({ row }) => labels.dateTime(row.original.createdAt),
      },
    ],
    [backoffice.organizations, common, labels, t],
  )

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          canCreate ? (
            <Button
              nativeButton={false}
              render={<Link href="/applications/new" />}
            >
              <Plus />
              {t("add")}
            </Button>
          ) : undefined
        }
      />
      <MetricCard
        icon={AppWindow}
        title={t("total")}
        value={backoffice.applications.length}
      />
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        data={backoffice.applications}
        getRowId={(row) => row.id}
        getRowHref={(row) =>
          canViewDetail ? `/applications/${row.id}` : undefined
        }
        getRowLabel={(row) => `${row.name} ${common("details")}`}
        empty={t("empty")}
        filterLabel={common("search")}
        noResults={common("noResults")}
        filters={[
          { id: "name", label: t("name"), getValue: (row) => row.name },
          { id: "slug", label: t("slug"), getValue: (row) => row.slug },
          {
            id: "owner",
            label: t("ownerOrganization"),
            getValue: (row) =>
              backoffice.organizations.find(
                (organization) => organization.id === row.ownerOrganizationId,
              )?.name ?? "",
          },
        ]}
      />
    </div>
  )
}

export function ApplicationDetailPage({
  applicationId,
}: {
  applicationId: string
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.applications")
  const credentialsT = useTranslations("backoffice.apiKeys")
  const application = backoffice.applications.find(
    (item) => item.id === applicationId,
  )

  if (!application) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          <Button render={<Link href="/applications" />}>
            {common("backToList")}
          </Button>
        }
      />
    )
  }

  const ownerOrganization = backoffice.organizations.find(
    (organization) => organization.id === application.ownerOrganizationId,
  )
  const credentials = backoffice.apiKeys.filter(
    (credential) => credential.applicationId === application.id,
  )
  const assignments = backoffice.accessPolicyAssignments.filter(
    (assignment) =>
      assignment.targetType === accessPolicyAssignmentTargets.application &&
      assignment.targetId === application.id,
  )
  const policies = assignments.flatMap((assignment) => {
    const policy = backoffice.accessPolicies.find(
      (candidate) => candidate.id === assignment.accessPolicyId,
    )
    return policy ? [policy] : []
  })
  const credentialColumns: ColumnDef<ApiKey>[] = [
    { accessorKey: "name", header: credentialsT("keyName") },
    {
      id: "service",
      header: credentialsT("service"),
      cell: ({ row }) =>
        backoffice.services.find(
          (service) => service.id === row.original.serviceId,
        )?.name ?? common("none"),
    },
    {
      id: "status",
      header: common("status"),
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === entityStatuses.active
              ? "success"
              : "secondary"
          }
        >
          {common(row.original.status)}
        </Badge>
      ),
    },
  ]

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={application.name}
        description={t("detailDescription")}
        actions={
          <>
            {sessionAccess.canAccessUiResource(
              uiResourceKeys.applications.detail.actions.updateApplication,
            ) ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={`/applications/${application.id}/edit`} />}
              >
                <Pencil />
                {t("edit")}
              </Button>
            ) : null}
            {sessionAccess.canAccessUiResource(
              uiResourceKeys.applications.detail.actions.deleteApplication,
            ) ? (
              <ConfirmAction
                trigger={
                  <>
                    <Trash2 />
                    {common("delete")}
                  </>
                }
                title={t("deleteTitle", { name: application.name })}
                description={t("deleteDescription")}
                confirmLabel={common("delete")}
                cancelLabel={common("cancel")}
                onConfirm={async () => {
                  const result = await backoffice.deleteApplication(
                    application.id,
                    sessionAccess.currentUser?.id ?? "",
                  )
                  if (!result.ok) return
                  snackbar.success(t("deleted"))
                  router.push("/applications")
                }}
              />
            ) : null}
          </>
        }
      />
      <DetailGrid>
        <DetailItem label={t("name")}>{application.name}</DetailItem>
        <DetailItem label={t("slug")}>
          <code>{application.slug}</code>
        </DetailItem>
        <DetailItem label={t("ownerOrganization")}>
          {ownerOrganization ? (
            <Link
              className="text-primary hover:underline"
              href={`/organizations/${ownerOrganization.id}`}
            >
              {ownerOrganization.name}
            </Link>
          ) : (
            common("none")
          )}
        </DetailItem>
        <DetailItem
          label={t("applicationDescription")}
          className="sm:col-span-2"
        >
          {application.description}
        </DetailItem>
      </DetailGrid>
      <DataTable
        caption={t("credentialsCaption")}
        columns={credentialColumns}
        data={credentials}
        getRowId={(row) => row.id}
        getRowHref={(row) => `/credentials/${row.id}`}
        getRowLabel={(row) => `${row.name} ${common("details")}`}
        empty={t("credentialsEmpty")}
        filterLabel={common("search")}
        noResults={common("noResults")}
        filters={[
          {
            id: "credential",
            label: credentialsT("keyName"),
            getValue: (row) => row.name,
          },
        ]}
      />
      <DataTable
        caption={t("policiesCaption")}
        columns={[
          { accessorKey: "name", header: t("policyName") },
          {
            id: "managementType",
            header: t("managementType"),
            cell: ({ row }) => (
              <Badge variant="info">
                {t(`managementTypes.${row.original.managementType}`)}
              </Badge>
            ),
          },
        ]}
        data={policies}
        getRowId={(row) => row.id}
        getRowHref={(row) => `/approval-documents/${row.id}`}
        getRowLabel={(row) => `${row.name} ${common("details")}`}
        empty={t("policiesEmpty")}
        filterLabel={common("search")}
        noResults={common("noResults")}
        filters={[
          { id: "policy", label: t("policyName"), getValue: (row) => row.name },
        ]}
      />
    </div>
  )
}
