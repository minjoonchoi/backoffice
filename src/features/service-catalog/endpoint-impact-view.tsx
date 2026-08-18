"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { useTranslations } from "next-intl"
import { useMemo } from "react"

import { AccessPolicyReferenceTable } from "@/application/ui/access-policy-reference-table"
import { DataTable } from "@/components/patterns/data-table"
import { Badge } from "@/components/ui/badge"
import {
  endpointFieldChangeTypes,
  type EndpointChangeImpact,
  type EndpointFieldChangeType,
} from "@/features/service-catalog/endpoint-impact"
import type { ServiceEndpointFieldInput } from "@/features/service-catalog/model"

type EndpointFieldChangeRow = Readonly<{
  id: string
  type: EndpointFieldChangeType
  before: ServiceEndpointFieldInput | null
  after: ServiceEndpointFieldInput | null
}>

function FieldConfiguration({
  field,
}: {
  field: ServiceEndpointFieldInput | null
}) {
  const t = useTranslations("backoffice.endpoints")
  if (!field) return <span className="text-muted-foreground">—</span>
  return (
    <span className="grid min-w-0 gap-1">
      <span className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{field.valueType}</Badge>
        <Badge variant={field.required ? "info" : "outline"}>
          {t(field.required ? "requiredParameter" : "optionalParameter")}
        </Badge>
      </span>
      <span className="text-xs break-words text-text-subtle">
        {field.description || t("fieldDescriptionEmpty")}
      </span>
    </span>
  )
}

export function EndpointReferencedPoliciesTable({
  policyIds,
}: {
  policyIds: readonly string[]
}) {
  const t = useTranslations("backoffice.endpoints")
  return (
    <AccessPolicyReferenceTable
      policyIds={policyIds}
      caption={t("referencedPolicies")}
      empty={t("referencedPoliciesEmpty")}
    />
  )
}

export function EndpointChangeImpactPanel({
  impact,
}: {
  impact: EndpointChangeImpact
}) {
  const t = useTranslations("backoffice.endpoints")
  const common = useTranslations("backoffice.common")
  const changes = useMemo<EndpointFieldChangeRow[]>(
    () => [
      ...impact.addedFields.map((field) => ({
        id: `${endpointFieldChangeTypes.added}:${field.location}:${field.fieldPath}`,
        type: endpointFieldChangeTypes.added,
        before: null,
        after: field,
      })),
      ...impact.removedFields.map((field) => ({
        id: `${endpointFieldChangeTypes.removed}:${field.location}:${field.fieldPath}`,
        type: endpointFieldChangeTypes.removed,
        before: field,
        after: null,
      })),
      ...impact.changedFields.map(({ before, after }) => ({
        id: `${endpointFieldChangeTypes.changed}:${after.location}:${after.fieldPath}`,
        type: endpointFieldChangeTypes.changed,
        before,
        after,
      })),
    ],
    [impact],
  )
  const columns = useMemo<ColumnDef<EndpointFieldChangeRow>[]>(
    () => [
      {
        accessorKey: "type",
        header: t("changeType"),
        size: 100,
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.type === endpointFieldChangeTypes.added
                ? "success"
                : row.original.type === endpointFieldChangeTypes.removed
                  ? "destructive"
                  : "warning"
            }
          >
            {t(`fieldChangeTypes.${row.original.type}`)}
          </Badge>
        ),
      },
      {
        id: "location",
        header: t("location"),
        size: 130,
        cell: ({ row }) => {
          const field = row.original.after ?? row.original.before
          return field ? (
            <Badge variant="outline">{t(`locations.${field.location}`)}</Badge>
          ) : null
        },
      },
      {
        id: "fieldPath",
        header: t("fieldPath"),
        size: 220,
        cell: ({ row }) => (
          <code className="text-xs break-all">
            {(row.original.after ?? row.original.before)?.fieldPath}
          </code>
        ),
      },
      {
        accessorKey: "before",
        header: t("beforeChange"),
        size: 260,
        cell: ({ row }) => <FieldConfiguration field={row.original.before} />,
      },
      {
        accessorKey: "after",
        header: t("afterChange"),
        size: 260,
        cell: ({ row }) => <FieldConfiguration field={row.original.after} />,
      },
    ],
    [t],
  )

  return (
    <section className="grid gap-4 rounded-card border border-warning-foreground/30 bg-warning p-3">
      <div className="grid gap-1">
        <h3 className="font-semibold">{t("changeImpactTitle")}</h3>
        <p className="text-sm text-warning-foreground">
          {t("changeImpactDescription")}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="success">
          {t("addedFieldCount", { count: impact.addedFields.length })}
        </Badge>
        <Badge variant="destructive">
          {t("removedFieldCount", { count: impact.removedFields.length })}
        </Badge>
        <Badge variant="warning">
          {t("changedFieldCount", { count: impact.changedFields.length })}
        </Badge>
        <Badge variant="outline">
          {t("affectedPolicyCount", { count: impact.accessPolicyIds.length })}
        </Badge>
        <Badge variant="outline">
          {t("affectedCredentialCount", { count: impact.apiKeyIds.length })}
        </Badge>
      </div>
      <div className="grid gap-2">
        <h4 className="text-sm font-semibold">{t("fieldChangeDetails")}</h4>
        <DataTable
          caption={t("fieldChangeDetails")}
          columns={columns}
          data={changes}
          getRowId={(row) => row.id}
          empty={t("fieldChangesEmpty")}
          filterLabel={common("search")}
          noResults={common("noResults")}
          filters={[
            {
              id: "fieldPath",
              label: t("fieldPath"),
              getValue: (row) => (row.after ?? row.before)?.fieldPath ?? "",
            },
          ]}
        />
      </div>
      <div className="grid gap-2">
        <h4 className="text-sm font-semibold">{t("referencedPolicies")}</h4>
        <EndpointReferencedPoliciesTable policyIds={impact.accessPolicyIds} />
      </div>
    </section>
  )
}
