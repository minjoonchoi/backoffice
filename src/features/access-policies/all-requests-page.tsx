"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { useTranslations } from "next-intl"

import { useBackoffice } from "@/application/state/provider"
import {
  ApprovalStatusBadge,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"
import { useSessionAccess } from "@/auth/session-access-provider"
import { UiResourceLink } from "@/auth/ui-resource-link"
import { DataTable } from "@/components/patterns/data-table"
import { EmptyState } from "@/components/patterns/content-state"
import { PageHeader } from "@/components/patterns/page-header"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { uiResourceKeys } from "@/config/menu-registry"
import {
  approvalDocumentKinds,
  type ApprovalDocument,
} from "@/features/access-policies/model"
import {
  requestCategoryValues,
  type RequestCategory,
} from "@/features/request-templates/model"

function resolveRequestCategory(document: ApprovalDocument): RequestCategory {
  return document.documentKind === approvalDocumentKinds.general
    ? requestCategoryValues.permission
    : requestCategoryValues.credential
}

export function AllRequestsPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.requests")
  const common = useTranslations("backoffice.common")
  const labels = useBackofficeLabels()
  const canViewRequestDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.approvalDocuments.requestDetail.key,
  )
  const requests = backoffice.approvalDocuments.toSorted((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )
  const columns: ColumnDef<ApprovalDocument>[] = [
    {
      accessorKey: "title",
      header: t("requestTitle"),
      size: 250,
      cell: ({ row }) => (
        <span className="block truncate font-medium" title={row.original.title}>
          {row.original.title}
        </span>
      ),
    },
    {
      id: "category",
      header: t("requestCategory"),
      size: 125,
      cell: ({ row }) => {
        const category = resolveRequestCategory(row.original)
        return (
          <Badge
            variant={
              category === requestCategoryValues.permission ? "info" : "outline"
            }
          >
            {t(`requestCategories.${category}`)}
          </Badge>
        )
      },
    },
    {
      accessorKey: "type",
      header: t("requestType"),
      size: 180,
      cell: ({ row }) => (
        <span
          className="block truncate"
          title={labels.approvalType(row.original.type)}
        >
          {labels.approvalType(row.original.type)}
        </span>
      ),
    },
    {
      id: "requester",
      header: t("requester"),
      size: 120,
      cell: ({ row }) => {
        const requester = backoffice.users.find(
          (user) => user.id === row.original.requesterId,
        )
        if (!requester) {
          throw new Error(
            `Approval requester not found: ${row.original.requesterId}`,
          )
        }
        return (
          <UiResourceLink
            resourceKey={uiResourceKeys.users.detail.key}
            href={`/users/${requester.id}`}
            className="block truncate text-primary hover:underline"
          >
            {requester.nickname}
          </UiResourceLink>
        )
      },
    },
    {
      id: "organization",
      header: t("requestOrganization"),
      size: 150,
      cell: ({ row }) => {
        const organization = backoffice.organizations.find(
          (candidate) => candidate.id === row.original.organizationId,
        )
        if (!organization) {
          throw new Error(
            `Approval request organization not found: ${row.original.organizationId}`,
          )
        }
        return (
          <UiResourceLink
            resourceKey={uiResourceKeys.organizations.detail.key}
            href={`/organizations/${organization.id}`}
            className="block truncate text-primary hover:underline"
          >
            {organization.name}
          </UiResourceLink>
        )
      },
    },
    {
      accessorKey: "status",
      header: common("status"),
      size: 100,
      cell: ({ row }) => <ApprovalStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: t("requestedAt"),
      size: 170,
      cell: ({ row }) => labels.dateTime(row.original.createdAt),
    },
  ]

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("listTitle")}</CardTitle>
          <CardDescription>{t("listDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            caption={t("tableCaption")}
            columns={columns}
            data={requests}
            getRowId={(request) => request.id}
            getRowHref={(request) =>
              canViewRequestDetail
                ? `/approval-documents/requests/${request.id}`
                : undefined
            }
            getRowLabel={(request) => t("openDetail", { title: request.title })}
            filters={[
              {
                id: "request-title",
                label: t("requestTitle"),
                getValue: (request) => request.title,
              },
              {
                id: "request-category",
                label: t("requestCategory"),
                getValue: (request) =>
                  t(`requestCategories.${resolveRequestCategory(request)}`),
              },
              {
                id: "request-type",
                label: t("requestType"),
                getValue: (request) => labels.approvalType(request.type),
              },
              {
                id: "requester",
                label: t("requester"),
                getValue: (request) =>
                  backoffice.users.find(
                    (user) => user.id === request.requesterId,
                  )?.nickname ?? "",
              },
              {
                id: "request-organization",
                label: t("requestOrganization"),
                getValue: (request) =>
                  backoffice.organizations.find(
                    (organization) =>
                      organization.id === request.organizationId,
                  )?.name ?? "",
              },
              {
                id: "request-status",
                label: common("status"),
                getValue: (request) => t(`requestStatuses.${request.status}`),
              },
            ]}
            filterLabel={common("search")}
            empty={
              <EmptyState
                title={t("empty")}
                description={t("emptyDescription")}
              />
            }
            noResults={
              <EmptyState
                title={common("noResults")}
                description={t("noResultsDescription")}
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
