"use client"

import { uiResourceKeys } from "@/config/menu-registry"
import type { ColumnDef } from "@tanstack/react-table"
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
import { snackbar } from "@/components/ui/snackbar"
import { resolveMissingAccessPolicyResources } from "@/features/access-policies/access-policy-assignment"
import { AccessPolicyCreationDialog } from "@/features/access-policies/access-policy-creation-dialog"
import { accessPolicyApprovalLines } from "@/features/access-policies/access-policy-template"
import type {
  AccessPolicy,
  ApprovalDocument,
} from "@/features/access-policies/model"
import { useBackoffice } from "@/application/state/provider"
import {
  AccessPolicyEffectBadge,
  ApprovalStatusBadge,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

export function ApprovalReviewPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const canCreatePolicy = sessionAccess.canAccessUiResource(
    uiResourceKeys.approvalDocuments.list.actions.createPolicy,
  )
  const canApproveAccessRequest = sessionAccess.canAccessUiResource(
    uiResourceKeys.approvalDocuments.list.actions.approveAccessRequest,
  )
  const canViewPolicyDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.approvalDocuments.detail.key,
  )
  const t = useTranslations("backoffice.approvalDocuments")
  const linesT = useTranslations("backoffice.approvalLines")
  const common = useTranslations("backoffice.common")
  const errorsT = useTranslations("backoffice.errors")
  const labels = useBackofficeLabels()
  async function approve(document: ApprovalDocument) {
    const result = await backoffice.approveApprovalDocument(document.id)
    if (!result.ok) {
      snackbar.error(errorsT(result.error))
      return
    }
    snackbar.success(t("approved"))
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
    {
      id: "action",
      header: "",
      cell: ({ row }) =>
        row.original.status === "submitted" && canApproveAccessRequest ? (
          <Button
            size="sm"
            onClick={() => {
              void approve(row.original)
            }}
          >
            {t("approve")}
          </Button>
        ) : null,
    },
  ]
  function isUiRenderingPolicy(policy: AccessPolicy) {
    return policy.resources.every((resource) => resource.type === "ui-resource")
  }
  const policies = backoffice.accessPolicies
    .filter(
      (policy) =>
        policy.status === "active" &&
        accessPolicyApprovalLines(backoffice, policy.type).length === 1,
    )
    .toSorted((left, right) => {
      const scopeOrder =
        Number(isUiRenderingPolicy(left)) - Number(isUiRenderingPolicy(right))
      return scopeOrder || right.createdAt.localeCompare(left.createdAt)
    })
  const permissionRequests = backoffice.approvalDocuments.filter(
    (document) => document.documentKind === "general",
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
      id: "resources",
      header: t("resources"),
      cell: ({ row }) =>
        t("resourceCount", { count: row.original.resources.length }),
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
        actions={canCreatePolicy ? <AccessPolicyCreationDialog /> : undefined}
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
                getValue: (row) =>
                  row.status === "draft"
                    ? t("draft")
                    : row.status === "approved"
                      ? t("approvedStatus")
                      : t("submittedStatus"),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
