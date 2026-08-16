"use client"

import { employmentStatusValues } from "@/features/iam/model"
import { Copy, FlaskConical, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { useBackoffice } from "@/application/state/provider"
import { FormSelect } from "@/components/patterns/form-select"
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
import {
  resolveAccessPolicyConflicts,
  simulateAccessPolicyGrant,
} from "@/features/access-policies/access-policy-analysis"
import type {
  AccessPolicy,
  AccessPolicyResource,
  AccessPolicyResourceType,
} from "@/features/access-policies/model"
import {
  resolveAccessPolicyResourceDisplay,
  type AccessPolicyResourceDisplay,
} from "@/features/access-policies/access-policy-resources"

function resourceLabel(resource: AccessPolicyResource) {
  return `${resource.type}:${resource.id}`
}

export function AccessPolicyCloneLink({ policy }: { policy: AccessPolicy }) {
  const t = useTranslations("backoffice.approvalDocuments")

  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={
        <Link
          href={`/approval-documents/new?sourcePolicyId=${encodeURIComponent(policy.id)}`}
        />
      }
    >
      <Copy />
      {t("clonePolicy")}
    </Button>
  )
}

export function AccessPolicyConflictDialog() {
  const backoffice = useBackoffice()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.approvalDocuments")
  const conflicts = useMemo(
    () => resolveAccessPolicyConflicts(backoffice.accessPolicies),
    [backoffice.accessPolicies],
  )
  const policyName = (id: string) =>
    backoffice.accessPolicies.find((policy) => policy.id === id)?.name ?? id

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <ShieldAlert />
        {t("analyzeConflicts")}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("conflictTitle")}</DialogTitle>
          <DialogDescription>{t("conflictDescription")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(60svh,32rem)] overflow-y-auto rounded-card border">
          {conflicts.length > 0 ? (
            <ul className="divide-y divide-border-subtle">
              {conflicts.map((conflict) => (
                <li
                  key={resourceLabel(conflict.resource)}
                  className="grid gap-2 p-3"
                >
                  {(() => {
                    const resource = resolveAccessPolicyResourceDisplay(
                      backoffice,
                      conflict.resource,
                    )
                    return (
                      <span className="grid min-w-0 gap-0.5">
                        <span className="font-medium">{resource.name}</span>
                        {resource.scope ? (
                          <span className="text-xs text-muted-foreground">
                            {resource.scope}
                          </span>
                        ) : null}
                        <code className="text-xs break-all">
                          {resource.identifier}
                        </code>
                      </span>
                    )
                  })()}
                  <div className="flex flex-wrap gap-2">
                    {conflict.allowPolicyIds.map((id) => (
                      <Badge key={id} variant="success">
                        {policyName(id)}
                      </Badge>
                    ))}
                    {conflict.denyPolicyIds.map((id) => (
                      <Badge key={id} variant="destructive">
                        {policyName(id)}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("conflictEmpty")}
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button />}>{common("close")}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AccessPolicySimulationDialog() {
  const backoffice = useBackoffice()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.approvalDocuments")
  const [userId, setUserId] = useState(backoffice.users[0]?.id ?? "")
  const [policyId, setPolicyId] = useState(
    backoffice.accessPolicies[0]?.id ?? "",
  )
  const policy = backoffice.accessPolicies.find((item) => item.id === policyId)
  const simulation =
    userId && policy
      ? simulateAccessPolicyGrant(backoffice, userId, policy)
      : null
  const displayResources = (resources: readonly AccessPolicyResource[]) =>
    resources.map((resource) =>
      resolveAccessPolicyResourceDisplay(backoffice, resource),
    )

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <FlaskConical />
        {t("simulateAccess")}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("simulationTitle")}</DialogTitle>
          <DialogDescription>{t("simulationDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect
            label={t("simulationUser")}
            value={userId}
            onValueChange={(value) => {
              setUserId(value ?? "")
            }}
            options={backoffice.users
              .filter(
                (user) =>
                  user.employmentStatus === employmentStatusValues.employed,
              )
              .map((user) => ({
                value: user.id,
                label: `${user.nickname} · ${user.email}`,
              }))}
          />
          <FormSelect
            label={t("simulationPolicy")}
            value={policyId}
            onValueChange={(value) => {
              setPolicyId(value ?? "")
            }}
            options={backoffice.accessPolicies.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
          />
        </div>
        {simulation ? (
          <div className="grid gap-3 lg:grid-cols-3">
            <SimulationResult
              title={t("simulationGranted")}
              variant="success"
              resources={displayResources(simulation.granted)}
            />
            <SimulationResult
              title={t("simulationExisting")}
              variant="secondary"
              resources={displayResources(simulation.alreadyGranted)}
            />
            <SimulationResult
              title={t("simulationDenied")}
              variant="destructive"
              resources={displayResources(simulation.denied)}
            />
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button />}>{common("close")}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SimulationResult({
  title,
  variant,
  resources,
}: {
  title: string
  variant: "success" | "secondary" | "destructive"
  resources: readonly AccessPolicyResourceDisplay[]
}) {
  const t = useTranslations("backoffice.approvalDocuments")
  const resourceTypes: readonly AccessPolicyResourceType[] = [
    "endpoint",
    "ui-resource",
  ]

  return (
    <section className="grid min-w-0 content-start gap-3 rounded-card border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant={variant}>{resources.length}</Badge>
      </div>
      {resources.length > 0 ? (
        <div className="grid max-h-[min(48svh,28rem)] gap-3 overflow-y-auto pr-1">
          {resourceTypes.map((type) => {
            const typedResources = resources.filter(
              ({ reference }) => reference.type === type,
            )
            if (typedResources.length === 0) return null
            return (
              <section key={type} className="grid gap-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground">
                  {t(`resourceTypeLabels.${type}`)} · {typedResources.length}
                </h4>
                <ul className="grid gap-1.5">
                  {typedResources.map((resource) => (
                    <li
                      key={resourceLabel(resource.reference)}
                      className="grid min-w-0 gap-0.5 rounded-control bg-surface-subtle p-2"
                    >
                      <span className="text-sm font-medium">
                        {resource.name}
                      </span>
                      {resource.scope ? (
                        <span className="text-xs text-muted-foreground">
                          {resource.scope}
                        </span>
                      ) : null}
                      <code className="text-xs break-all text-text-subtle">
                        {resource.identifier}
                      </code>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t("simulationResultEmpty")}
        </p>
      )}
    </section>
  )
}
