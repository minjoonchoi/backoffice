"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { useTranslations } from "next-intl"

import { useSessionAccess } from "@/auth/session-access-provider"
import { UiResourceLink } from "@/auth/ui-resource-link"
import { AssignmentDialog } from "@/application/ui/assignment-dialog"
import { RelationshipRemoveAction } from "@/application/ui/relationship-remove-action"
import { useBackoffice } from "@/application/state/provider"
import {
  AccessPolicyEffectBadge,
  StatusBadge,
} from "@/application/ui/backoffice-ui"
import { DataTable } from "@/components/patterns/data-table"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { uiResourceKeys } from "@/config/menu-registry"
import { resolveAccessPolicyAssignmentAffectedUserIds } from "@/features/access-policies/access-policy-assignment"
import type {
  AccessPolicy,
  AccessPolicyAssignment,
} from "@/features/access-policies/model"

type PolicyAssignmentRow = Readonly<{
  assignment: AccessPolicyAssignment
  policy: AccessPolicy
}>

export function AccessPolicyAssignmentCard({
  targetType,
  targetId,
  targetName,
  canManage = false,
}: {
  targetType: "organization" | "role" | "group"
  targetId: string
  targetName: string
  canManage?: boolean
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.approvalDocuments")
  const assignments = backoffice.accessPolicyAssignments.filter(
    (assignment) =>
      assignment.targetType === targetType && assignment.targetId === targetId,
  )
  const rows = assignments.map((assignment): PolicyAssignmentRow => {
    const policy = backoffice.accessPolicies.find(
      (candidate) => candidate.id === assignment.accessPolicyId,
    )
    if (!policy) throw new Error(`Assigned policy not found: ${assignment.id}`)
    return { assignment, policy }
  })
  const assignedPolicyIds = new Set(rows.map(({ policy }) => policy.id))
  const candidates = backoffice.accessPolicies.filter(
    (policy) => policy.status === "active" && !assignedPolicyIds.has(policy.id),
  )
  const administratorAssignmentIds = new Set(
    backoffice.uiNamespaces.flatMap((namespace) =>
      namespace.administratorRoleId === targetId
        ? [namespace.administratorAccessPolicyId]
        : [],
    ),
  )

  const columns: ColumnDef<PolicyAssignmentRow>[] = [
    {
      id: "name",
      header: t("policyName"),
      cell: ({ row }) => (
        <UiResourceLink
          resourceKey={uiResourceKeys.approvalDocuments.detail.key}
          href={`/approval-documents/${row.original.policy.id}`}
        >
          {row.original.policy.name}
        </UiResourceLink>
      ),
    },
    {
      id: "effect",
      header: t("effect"),
      cell: ({ row }) => (
        <AccessPolicyEffectBadge effect={row.original.policy.effect} />
      ),
    },
    {
      id: "resourceType",
      header: t("resourceType"),
      cell: ({ row }) => {
        const resource = row.original.policy.resources[0]
        if (!resource)
          throw new Error(
            `Policy resource not found: ${row.original.policy.id}`,
          )
        return (
          <Badge variant="secondary">
            {t(`resourceTypeLabels.${resource.type}`)}
          </Badge>
        )
      },
    },
    {
      id: "resources",
      header: t("resources"),
      cell: ({ row }) =>
        t("resourceCount", { count: row.original.policy.resources.length }),
    },
    {
      id: "status",
      header: common("status"),
      cell: ({ row }) => <StatusBadge status={row.original.policy.status} />,
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: common("actions"),
            size: 100,
            cell: ({ row }) => {
              const affectedUserIds =
                resolveAccessPolicyAssignmentAffectedUserIds(
                  backoffice,
                  row.original.assignment.id,
                )
              const isProtected = administratorAssignmentIds.has(
                row.original.policy.id,
              )
              return (
                <RelationshipRemoveAction
                  subjectName={targetName}
                  targetName={row.original.policy.name}
                  impactDescription={
                    isProtected
                      ? t("protectedPolicyAssignment")
                      : t("policyRevokeImpact", {
                          count: affectedUserIds.length,
                        })
                  }
                  confirmDisabled={isProtected}
                  onRemove={() =>
                    backoffice.unassignAccessPolicyFromTarget(
                      row.original.assignment.id,
                      sessionAccess.currentUser?.id ?? "",
                    )
                  }
                />
              )
            },
          } satisfies ColumnDef<PolicyAssignmentRow>,
        ]
      : []),
  ]

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="grid gap-1.5">
          <CardTitle>{t("assignedPolicies")}</CardTitle>
          <CardDescription>
            {t("targetAssignedPoliciesDescription")}
          </CardDescription>
        </div>
        {canManage ? (
          <AssignmentDialog
            triggerLabel={t("assignPolicies")}
            title={t("assignPolicies")}
            description={t("assignPoliciesDescription", { name: targetName })}
            searchLabel={t("policySearch")}
            options={candidates.map((policy) => ({
              id: policy.id,
              title: policy.name,
              description: policy.description,
              searchText: `${policy.name} ${policy.description}`,
            }))}
            successMessage={t("policiesAssigned")}
            onAssign={(accessPolicyIds) =>
              backoffice.assignAccessPoliciesToTarget(
                accessPolicyIds,
                targetType,
                targetId,
                sessionAccess.currentUser?.id ?? "",
              )
            }
          />
        ) : null}
      </CardHeader>
      <CardContent>
        <DataTable
          caption={t("assignedPolicies")}
          columns={columns}
          data={rows}
          getRowId={(row) => row.assignment.id}
          getRowHref={(row) => `/approval-documents/${row.policy.id}`}
          getRowLabel={(row) => `${row.policy.name} ${common("details")}`}
          empty={t("assignedPoliciesEmpty")}
        />
      </CardContent>
    </Card>
  )
}
