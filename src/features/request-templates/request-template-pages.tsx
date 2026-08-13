"use client"

import { uiResourceKeys } from "@/config/menu-registry"
import type { ColumnDef } from "@tanstack/react-table"
import { Pencil, Plus } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { UiResourceLink } from "@/auth/ui-resource-link"
import { EmptyState } from "@/components/patterns/content-state"
import { DataTable } from "@/components/patterns/data-table"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
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
import {
  type ApprovalLine,
  type ApprovalStep,
  type RequestTemplateField,
} from "@/features/request-templates/model"
import { RequestTemplateEditorDialog } from "@/features/request-templates/request-template-editor-dialog"
import { useBackoffice } from "@/application/state/provider"
import {
  StatusBadge,
  StatusSwitch,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

function useRequestTemplatePermissions() {
  const sessionAccess = useSessionAccess()
  return {
    canViewList: sessionAccess.canAccessUiResource(
      uiResourceKeys.approvalLines.list.key,
    ),
    canCreate: sessionAccess.canAccessUiResource(
      uiResourceKeys.approvalLines.list.actions.createRequestTemplate,
    ),
    canEdit: sessionAccess.canAccessUiResource(
      uiResourceKeys.approvalLines.detail.actions.updateRequestTemplate,
    ),
    canChangeStatus: sessionAccess.canAccessUiResource(
      uiResourceKeys.approvalLines.list.actions.changeRequestTemplateStatus,
    ),
    canViewDetail: sessionAccess.canAccessUiResource(
      uiResourceKeys.approvalLines.detail.key,
    ),
  }
}

export function ApprovalLinesPage() {
  const backoffice = useBackoffice()
  const t = useTranslations("backoffice.approvalLines")
  const common = useTranslations("backoffice.common")
  const labels = useBackofficeLabels()
  const permissions = useRequestTemplatePermissions()
  const [editorOpen, setEditorOpen] = useState(false)
  const columns = useMemo<ColumnDef<ApprovalLine>[]>(
    () => [
      {
        accessorKey: "name",
        header: common("name"),
      },
      {
        accessorKey: "category",
        header: t("category"),
        cell: ({ row }) => t(`categories.${row.original.category}`),
      },
      {
        accessorKey: "type",
        header: t("type"),
        cell: ({ row }) => labels.approvalType(row.original.type),
      },
      {
        id: "steps",
        header: t("stepCount"),
        cell: ({ row }) => row.original.steps.length,
      },
      {
        id: "fields",
        header: t("fieldCount"),
        cell: ({ row }) => row.original.fields.length,
      },
      {
        id: "status",
        header: common("status"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <StatusBadge status={row.original.status} />
            {permissions.canChangeStatus ? (
              <StatusSwitch
                status={row.original.status}
                label={`${row.original.name} ${t("statusLabel")}`}
                onChange={(status) =>
                  backoffice.setApprovalLineStatus(row.original.id, status)
                }
              />
            ) : null}
          </div>
        ),
      },
    ],
    [common, labels, permissions.canChangeStatus, t, backoffice],
  )

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          permissions.canCreate ? (
            <Button
              onClick={() => {
                setEditorOpen(true)
              }}
            >
              <Plus />
              {t("add")}
            </Button>
          ) : null
        }
      />
      {editorOpen ? (
        <RequestTemplateEditorDialog open onOpenChange={setEditorOpen} />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            caption={t("tableCaption")}
            columns={columns}
            data={backoffice.approvalLines}
            getRowId={(row) => row.id}
            getRowHref={(row) =>
              permissions.canViewDetail
                ? `/approval-lines/${row.id}`
                : undefined
            }
            getRowLabel={(row) => `${row.name} ${common("details")}`}
            empty={t("empty")}
            filterLabel={common("search")}
            noResults={common("noResults")}
            filters={[
              {
                id: "template-name",
                label: common("name"),
                getValue: (row) => row.name,
              },
              {
                id: "template-category",
                label: t("category"),
                getValue: (row) => t(`categories.${row.category}`),
              },
              {
                id: "template-type",
                label: t("type"),
                getValue: (row) => labels.approvalType(row.type),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export function ApprovalLineDetailPage({
  approvalLineId,
}: {
  approvalLineId: string
}) {
  const backoffice = useBackoffice()
  const t = useTranslations("backoffice.approvalLines")
  const common = useTranslations("backoffice.common")
  const labels = useBackofficeLabels()
  const permissions = useRequestTemplatePermissions()
  const [editorOpen, setEditorOpen] = useState(false)
  const template = backoffice.approvalLines.find(
    (item) => item.id === approvalLineId,
  )

  if (!template) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          permissions.canViewList ? (
            <Button render={<Link href="/approval-lines" />}>
              {common("backToList")}
            </Button>
          ) : undefined
        }
      />
    )
  }
  const steps = template.steps.toSorted(
    (left, right) => left.order - right.order,
  )
  const fields = template.fields.toSorted(
    (left, right) => left.order - right.order,
  )
  const stepColumns: ColumnDef<ApprovalStep>[] = [
    { accessorKey: "order", header: t("order"), size: 72 },
    {
      accessorKey: "stage",
      header: t("stageLabel"),
      size: 120,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>{row.original.stage}</span>
          {steps.filter((step) => step.stage === row.original.stage).length >
          1 ? (
            <Badge variant="info">{t("parallel")}</Badge>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "kind",
      header: t("step"),
      cell: ({ row }) => labels.stepKind(row.original.kind),
    },
    {
      accessorKey: "assigneeMode",
      header: t("assigneeMode"),
      cell: ({ row }) => labels.assigneeMode(row.original.assigneeMode),
    },
    {
      id: "assignee",
      header: t("assignee"),
      cell: ({ row }) => {
        const step = row.original
        if (step.assigneeMode === "fixed-user") {
          const user = backoffice.users.find((item) => item.id === step.userId)
          if (!user)
            throw new Error(`Request template user not found: ${step.userId}`)
          return (
            <UiResourceLink
              resourceKey={uiResourceKeys.users.detail.key}
              href={`/users/${user.id}`}
              className="text-primary hover:underline"
            >
              {user.nickname}
            </UiResourceLink>
          )
        }
        if (step.assigneeMode === "fixed-organization") {
          const organization = backoffice.organizations.find(
            (item) => item.id === step.organizationId,
          )
          if (!organization) {
            throw new Error(
              `Request template organization not found: ${step.organizationId}`,
            )
          }
          return (
            <UiResourceLink
              resourceKey={uiResourceKeys.organizations.detail.key}
              href={`/organizations/${organization.id}`}
              className="text-primary hover:underline"
            >
              {organization.name}
            </UiResourceLink>
          )
        }
        return labels.assigneeMode(step.assigneeMode)
      },
    },
  ]
  const fieldColumns: ColumnDef<RequestTemplateField>[] = [
    { accessorKey: "order", header: t("order"), size: 72 },
    { accessorKey: "label", header: t("fieldLabel") },
    {
      accessorKey: "key",
      header: t("fieldKey"),
      cell: ({ row }) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
          {row.original.key}
        </code>
      ),
    },
    {
      accessorKey: "binding",
      header: t("fieldBinding"),
      cell: ({ row }) => t(`fieldBindings.${row.original.binding}`),
    },
    {
      accessorKey: "control",
      header: t("fieldControl"),
      cell: ({ row }) => t(`fieldControls.${row.original.control}`),
    },
    {
      accessorKey: "required",
      header: t("fieldRequired"),
      cell: ({ row }) => (
        <Badge variant={row.original.required ? "info" : "secondary"}>
          {t(row.original.required ? "required" : "optional")}
        </Badge>
      ),
    },
  ]

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={template.name}
        description={t("detailDescription")}
        actions={
          permissions.canEdit ? (
            <Button
              variant="outline"
              onClick={() => {
                setEditorOpen(true)
              }}
            >
              <Pencil />
              {t("edit")}
            </Button>
          ) : null
        }
      />
      {editorOpen ? (
        <RequestTemplateEditorDialog
          open
          template={template}
          onOpenChange={setEditorOpen}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{t("overviewTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailItem label={t("category")}>
              {t(`categories.${template.category}`)}
            </DetailItem>
            <DetailItem label={t("type")}>
              {labels.approvalType(template.type)}
            </DetailItem>
            <DetailItem label={common("status")}>
              <StatusBadge status={template.status} />
            </DetailItem>
            <DetailItem label={t("stepCount")}>
              {template.steps.length}
            </DetailItem>
            <DetailItem label={t("fieldCount")}>
              {template.fields.length}
            </DetailItem>
            <DetailItem label={common("createdAt")}>
              {labels.dateTime(template.createdAt)}
            </DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("configuredStepsTitle")}</CardTitle>
          <CardDescription>{t("configuredStepsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            caption={t("configuredStepsTitle")}
            columns={stepColumns}
            data={steps}
            getRowId={(row) => row.id}
            empty={t("configuredStepsEmpty")}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("configuredFieldsTitle")}</CardTitle>
          <CardDescription>{t("configuredFieldsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            caption={t("configuredFieldsTitle")}
            columns={fieldColumns}
            data={fields}
            getRowId={(row) => row.id}
            empty={t("configuredFieldsEmpty")}
          />
        </CardContent>
      </Card>
    </div>
  )
}
