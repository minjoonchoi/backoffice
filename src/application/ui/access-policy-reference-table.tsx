"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { useTranslations } from "next-intl"
import { useMemo } from "react"

import { useBackoffice } from "@/application/state/provider"
import {
  AccessPolicyEffectBadge,
  StatusBadge,
} from "@/application/ui/backoffice-ui"
import { UiResourceLink } from "@/auth/ui-resource-link"
import { useSessionAccess } from "@/auth/session-access-provider"
import { DataTable } from "@/components/patterns/data-table"
import { uiResourceKeys } from "@/config/menu-registry"
import type { AccessPolicy } from "@/features/access-policies/model"

export function AccessPolicyReferenceTable({
  policyIds,
  caption,
  empty,
}: {
  policyIds: readonly string[]
  caption: string
  empty: string
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.approvalDocuments")
  const common = useTranslations("backoffice.common")
  const policyIdSet = new Set(policyIds)
  const policies = backoffice.accessPolicies.filter((policy) =>
    policyIdSet.has(policy.id),
  )
  const columns = useMemo<ColumnDef<AccessPolicy>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("policyName"),
        size: 240,
        cell: ({ row }) => (
          <UiResourceLink
            resourceKey={uiResourceKeys.approvalDocuments.detail.key}
            href={`/approval-documents/${row.original.id}`}
          >
            {row.original.name}
          </UiResourceLink>
        ),
      },
      {
        accessorKey: "effect",
        header: t("effect"),
        size: 100,
        cell: ({ row }) => (
          <AccessPolicyEffectBadge effect={row.original.effect} />
        ),
      },
      {
        id: "resourceCount",
        header: t("resources"),
        size: 130,
        cell: ({ row }) =>
          t("resourceCount", { count: row.original.resources.length }),
      },
      {
        accessorKey: "status",
        header: common("status"),
        size: 110,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [common, t],
  )

  return (
    <DataTable
      caption={caption}
      columns={columns}
      data={policies}
      getRowId={(policy) => policy.id}
      getRowHref={(policy) =>
        sessionAccess.canAccessUiResource(
          uiResourceKeys.approvalDocuments.detail.key,
        )
          ? `/approval-documents/${policy.id}`
          : undefined
      }
      getRowLabel={(policy) => `${policy.name} ${common("details")}`}
      empty={empty}
      filterLabel={common("search")}
      noResults={common("noResults")}
      filters={[
        {
          id: "name",
          label: t("policyName"),
          getValue: (policy) => policy.name,
        },
      ]}
    />
  )
}
