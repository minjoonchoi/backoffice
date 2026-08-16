"use client"

import { approvalDocumentStatuses } from "@/features/access-policies/model"
import { approvalDocumentKinds } from "@/features/access-policies/model"
import { accessPolicyResourceTypes } from "@/features/access-policies/model"
import { uiResourceKeys } from "@/config/menu-registry"
import type { ColumnDef } from "@tanstack/react-table"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { useSessionAccess } from "@/auth/session-access-provider"
import { UiResourceLink } from "@/auth/ui-resource-link"
import { DataTable } from "@/components/patterns/data-table"
import { PageHeader } from "@/components/patterns/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { resolveMissingAccessPolicyResources } from "@/features/access-policies/access-policy-assignment"
import { accessPolicyApprovalLines } from "@/features/access-policies/access-policy-template"
import type {
  AccessPolicy,
  ApprovalDocument,
} from "@/features/access-policies/model"
import { accessPolicyManagementTypes } from "@/features/access-policies/model"
import { useBackoffice } from "@/application/state/provider"
import {
  AccessPolicyEffectBadge,
  ApprovalStatusBadge,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

export function ApprovalReviewPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const canCreatePolicy =
    sessionAccess.canAccessUiResource(
      uiResourceKeys.approvalDocuments.list.actions.createPolicy,
    ) &&
    sessionAccess.canAccessUiResource(
      uiResourceKeys.approvalDocuments.create.key,
    )
  const canViewPolicyDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.approvalDocuments.detail.key,
  )
  const canViewRequestDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.approvalDocuments.requestDetail.key,
  )
  const t = useTranslations("backoffice.approvalDocuments")
  const linesT = useTranslations("backoffice.approvalLines")
  const common = useTranslations("backoffice.common")
  const labels = useBackofficeLabels()
  function requestStatusLabel(document: ApprovalDocument) {
    switch (document.status) {
      case approvalDocumentStatuses.draft:
        return t("draft")
      case approvalDocumentStatuses.submitted:
        return t("submittedStatus")
      case approvalDocumentStatuses.approved:
        return t("approvedStatus")
      case approvalDocumentStatuses.rejected:
        return t("rejectedStatus")
      case approvalDocumentStatuses.withdrawn:
        return t("withdrawnStatus")
    }
  }
  const columns: ColumnDef<ApprovalDocument>[] = [
    { accessorKey: "title", header: t("documentTitle") },
    {
      accessorKey: "type",
      header: linesT("type"),
      cell: ({ row }) => labels.approvalType(row.original.type),
    },
    {
      id: "requester",
      header: t("requester"),
      cell: ({ row }) => {
        const requester = backoffice.users.find(
          (item) => item.id === row.original.requesterId,
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
            className="text-primary hover:underline"
          >
            {requester.nickname}
          </UiResourceLink>
        )
      },
    },
    {
      accessorKey: "status",
      header: common("status"),
      cell: ({ row }) => <ApprovalStatusBadge status={row.original.status} />,
    },
  ]
  function isUiRenderingPolicy(policy: AccessPolicy) {
    return policy.resources.every(
      (resource) => resource.type === accessPolicyResourceTypes.uiResource,
    )
  }
  const policies = backoffice.accessPolicies
    .filter(
      (policy) =>
        accessPolicyApprovalLines(backoffice, policy.type).length === 1,
    )
    .toSorted((left, right) => {
      const scopeOrder =
        Number(isUiRenderingPolicy(left)) - Number(isUiRenderingPolicy(right))
      return scopeOrder || right.createdAt.localeCompare(left.createdAt)
    })
  const permissionRequests = backoffice.approvalDocuments.filter(
    (document) => document.documentKind === approvalDocumentKinds.general,
  )
  const policyColumns: ColumnDef<AccessPolicy>[] = [
    {
      id: "name",
      header: t("policyName"),
      cell: ({ row }) => row.original.name,
    },
    {
      accessorKey: "effect",
      header: t("effect"),
      cell: ({ row }) => (
        <AccessPolicyEffectBadge effect={row.original.effect} />
      ),
    },
    {
      accessorKey: "managementType",
      header: t("managementType"),
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.managementType ===
            accessPolicyManagementTypes.systemManaged
              ? "info"
              : "outline"
          }
        >
          {t(`managementTypes.${row.original.managementType}`)}
        </Badge>
      ),
    },
    {
      id: "ownership",
      header: t("ownership"),
      size: 112,
      cell: ({ row }) => {
        const missingCount = sessionAccess.currentUser
          ? resolveMissingAccessPolicyResources(
              backoffice,
              sessionAccess.currentUser.id,
              row.original,
            ).length
          : row.original.resources.length
        const owned = missingCount === 0
        const partiallyOwned =
          missingCount > 0 && missingCount < row.original.resources.length
        return (
          <Badge
            variant={
              owned ? "success" : partiallyOwned ? "warning" : "secondary"
            }
          >
            {partiallyOwned
              ? t("partiallyOwned", {
                  owned: row.original.resources.length - missingCount,
                  total: row.original.resources.length,
                })
              : t(owned ? "owned" : "notOwned")}
          </Badge>
        )
      },
    },
  ]
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          canCreatePolicy ? (
            <Button
              nativeButton={false}
              render={<Link href="/approval-documents/new" />}
            >
              <Plus />
              {t("createPolicy")}
            </Button>
          ) : undefined
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("catalogTitle")}</CardTitle>
          <CardDescription>{t("catalogHelp")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            caption={t("policyTableCaption")}
            columns={policyColumns}
            data={policies}
            getRowId={(row) => row.id}
            getRowHref={(row) =>
              canViewPolicyDetail ? `/approval-documents/${row.id}` : undefined
            }
            getRowLabel={(row) => `${row.name} ${common("details")}`}
            empty={t("policyEmpty")}
            filterLabel={common("search")}
            noResults={common("noResults")}
            filters={[
              {
                id: "policy-name",
                label: t("policyName"),
                getValue: (row) => row.name,
              },
              {
                id: "policy-effect",
                label: t("effect"),
                getValue: (row) => t(row.effect),
              },
              {
                id: "management-type",
                label: t("managementType"),
                getValue: (row) => t(`managementTypes.${row.managementType}`),
              },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("historyTitle")}</CardTitle>
          <CardDescription>{t("recentDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            caption={t("tableCaption")}
            columns={columns}
            data={permissionRequests}
            getRowId={(row) => row.id}
            getRowHref={(row) =>
              canViewRequestDetail
                ? `/approval-documents/requests/${row.id}`
                : undefined
            }
            getRowLabel={(row) => `${row.title} ${common("details")}`}
            empty={t("empty")}
            filterLabel={common("search")}
            noResults={common("noResults")}
            filters={[
              {
                id: "request-title",
                label: t("documentTitle"),
                getValue: (row) => row.title,
              },
              {
                id: "request-type",
                label: linesT("type"),
                getValue: (row) => labels.approvalType(row.type),
              },
              {
                id: "requester",
                label: t("requester"),
                getValue: (row) =>
                  backoffice.users.find((item) => item.id === row.requesterId)
                    ?.nickname ?? "",
              },
              {
                id: "request-status",
                label: common("status"),
                getValue: requestStatusLabel,
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
