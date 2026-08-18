"use client"

import { GitCompareArrows } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { RequestTargetSelector } from "@/features/credentials/request-target-selector"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useBackoffice } from "@/application/state/provider"
import { compareRoles } from "@/features/iam/role-analysis"

export function RoleComparisonDialog() {
  const backoffice = useBackoffice()
  const t = useTranslations("backoffice.roles")
  const common = useTranslations("backoffice.common")
  const [leftRoleId, setLeftRoleId] = useState(backoffice.roles[0]?.id ?? "")
  const [rightRoleId, setRightRoleId] = useState(backoffice.roles[1]?.id ?? "")
  const comparison = useMemo(
    () =>
      leftRoleId && rightRoleId && leftRoleId !== rightRoleId
        ? compareRoles(backoffice, leftRoleId, rightRoleId)
        : null,
    [backoffice, leftRoleId, rightRoleId],
  )
  const options = backoffice.roles.map((role) => ({
    id: role.id,
    title: role.name,
    description: role.description,
  }))
  const policyName = (id: string) =>
    backoffice.accessPolicies.find((policy) => policy.id === id)?.name ?? id
  const comparisonSections = comparison
    ? [
        {
          label: t("onlyLeft"),
          policyIds: comparison.onlyLeftPolicyIds,
          variant: "warning" as const,
        },
        {
          label: t("shared"),
          policyIds: comparison.sharedPolicyIds,
          variant: "success" as const,
        },
        {
          label: t("onlyRight"),
          policyIds: comparison.onlyRightPolicyIds,
          variant: "info" as const,
        },
      ]
    : []

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <GitCompareArrows />
        {t("compare")}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("compareTitle")}</DialogTitle>
          <DialogDescription>{t("compareDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <RequestTargetSelector
            label={t("comparisonLeft")}
            description={t("comparisonSearchDescription")}
            searchLabel={t("comparisonSearch")}
            empty={t("comparisonSearchEmpty")}
            value={leftRoleId}
            options={options}
            onValueChange={setLeftRoleId}
            listClassName="h-56 max-h-none"
          />
          <RequestTargetSelector
            label={t("comparisonRight")}
            description={t("comparisonSearchDescription")}
            searchLabel={t("comparisonSearch")}
            empty={t("comparisonSearchEmpty")}
            value={rightRoleId}
            options={options}
            onValueChange={setRightRoleId}
            listClassName="h-56 max-h-none"
          />
        </div>
        {comparison ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {comparisonSections.map(({ label, policyIds, variant }) => (
              <section
                key={label}
                className="grid content-start gap-2 rounded-card border p-3"
              >
                <h3 className="text-sm font-semibold">{label}</h3>
                <Badge variant={variant}>
                  {t("policyCount", { count: policyIds.length })}
                </Badge>
                <ul className="grid gap-1 text-sm">
                  {policyIds.length > 0 ? (
                    policyIds.map((id) => (
                      <li key={id} className="truncate" title={policyName(id)}>
                        {policyName(id)}
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground">{common("none")}</li>
                  )}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="rounded-card border bg-surface-subtle p-4 text-sm text-muted-foreground">
            {t("selectDifferentRoles")}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button />}>{common("close")}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
