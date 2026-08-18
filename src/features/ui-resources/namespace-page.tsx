"use client"

import { uiResourceKeys } from "@/config/menu-registry"
import type { ColumnDef } from "@tanstack/react-table"
import { Layers3, Plus } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useMemo } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { DataTable } from "@/components/patterns/data-table"
import { MetricCard } from "@/components/patterns/metric-card"
import { PageHeader } from "@/components/patterns/page-header"
import { Button } from "@/components/ui/button"
import type { Namespace } from "@/features/ui-resources/model"
import { useBackoffice } from "@/application/state/provider"
import {
  StatusBadge,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

function NamespacesTable({
  data,
  canViewDetail,
}: {
  data: Namespace[]
  canViewDetail: boolean
}) {
  const backoffice = useBackoffice()
  const t = useTranslations("backoffice.namespaces")
  const common = useTranslations("backoffice.common")
  const labels = useBackofficeLabels()
  const columns = useMemo<ColumnDef<Namespace>[]>(
    () => [
      {
        accessorKey: "key",
        header: t("key"),
        size: 180,
        cell: ({ row }) => <code>{row.original.key}</code>,
      },
      { accessorKey: "name", header: common("name"), size: 180 },
      {
        accessorKey: "description",
        header: t("namespaceDescription"),
        size: 340,
      },
      {
        id: "managerRole",
        header: t("managerRole"),
        size: 200,
        cell: ({ row }) => {
          const role = backoffice.roles.find(
            (candidate) => candidate.id === row.original.managerRoleId,
          )
          if (!role) {
            throw new Error(
              `Namespace management role not found: ${row.original.managerRoleId}`,
            )
          }
          return role.name
        },
      },
      {
        accessorKey: "lastSyncedAt",
        header: t("lastSyncedAt"),
        size: 180,
        cell: ({ row }) =>
          row.original.lastSyncedAt
            ? labels.dateTime(row.original.lastSyncedAt)
            : t("neverSynced"),
      },
      {
        accessorKey: "status",
        header: common("status"),
        size: 100,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [common, labels, t, backoffice.roles],
  )
  return (
    <DataTable
      caption={t("tableCaption")}
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      getRowHref={(row) =>
        canViewDetail ? `/namespaces/${row.id}` : undefined
      }
      getRowLabel={(row) => `${row.name} ${common("details")}`}
      empty={t("empty")}
      filterLabel={common("search")}
      noResults={common("noResults")}
      filters={[
        { id: "key", label: t("key"), getValue: (row) => row.key },
        { id: "name", label: common("name"), getValue: (row) => row.name },
      ]}
    />
  )
}

export function NamespacesPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.namespaces")
  const canCreate = sessionAccess.canAccessUiResource(
    uiResourceKeys.namespaces.list.actions.createNamespace,
  )
  const canViewDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.namespaces.detail.key,
  )

  return (
    <div
      className="grid gap-6"
      data-ui-resource={uiResourceKeys.namespaces.list.key}
    >
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          canCreate ? (
            <Button
              data-ui-resource={
                uiResourceKeys.namespaces.list.actions.createNamespace
              }
              nativeButton={false}
              render={<Link href="/namespaces/new" />}
            >
              <Plus aria-hidden />
              {t("add")}
            </Button>
          ) : null
        }
      />
      <div className="grid gap-3">
        <MetricCard
          icon={Layers3}
          title={t("total")}
          value={backoffice.namespaces.length}
        />
      </div>
      <NamespacesTable
        data={backoffice.namespaces}
        canViewDetail={canViewDetail}
      />
    </div>
  )
}
