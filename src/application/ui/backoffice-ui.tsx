"use client"

import { useLocale, useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type {
  AccessPolicyEffect,
  ApprovalDocument,
} from "@/features/access-policies/model"
import type {
  ApprovalAssigneeMode,
  ApprovalStepKind,
  ApprovalType,
} from "@/features/request-templates/model"
import type { EmploymentStatus } from "@/features/iam/model"
import type { ServiceType } from "@/features/service-catalog/model"
import type { EntityStatus, BackofficeErrorCode } from "@/domain/common"
import { employmentStatuses } from "@/features/iam/model"

export function StatusBadge({ status }: { status: EntityStatus }) {
  const t = useTranslations("backoffice.common")
  return (
    <Badge variant={status === "active" ? "success" : "secondary"}>
      {status === "active" ? t("active") : t("inactive")}
    </Badge>
  )
}

export function ApprovalStatusBadge({
  status,
}: {
  status: ApprovalDocument["status"]
}) {
  const t = useTranslations("backoffice.approvalDocuments")
  return (
    <Badge
      variant={
        status === "approved"
          ? "success"
          : status === "submitted"
            ? "warning"
            : "secondary"
      }
    >
      {status === "approved"
        ? t("approvedStatus")
        : status === "submitted"
          ? t("submittedStatus")
          : t("draft")}
    </Badge>
  )
}

export function ServiceTypeBadge({ type }: { type: ServiceType }) {
  const t = useTranslations("backoffice.serviceTypes")
  return (
    <Badge variant={type === "internal" ? "info" : "outline"}>{t(type)}</Badge>
  )
}

export function AccessPolicyEffectBadge({
  effect,
}: {
  effect: AccessPolicyEffect
}) {
  const t = useTranslations("backoffice.approvalDocuments")
  return (
    <Badge variant={effect === "allow" ? "success" : "destructive"}>
      {t(effect)}
    </Badge>
  )
}

export function EmploymentStatusBadge({
  status,
}: {
  status: EmploymentStatus
}) {
  const t = useTranslations("backoffice.employmentStatuses")
  return (
    <Badge
      variant={
        status === "employed"
          ? "success"
          : status === "on-leave"
            ? "warning"
            : "secondary"
      }
    >
      {t(status)}
    </Badge>
  )
}

export function EmploymentStatusSelect({
  status,
  label,
  onChange,
}: {
  status: EmploymentStatus
  label: string
  onChange: (status: EmploymentStatus) => void
}) {
  const t = useTranslations("backoffice.employmentStatuses")
  return (
    <Select
      value={status}
      items={employmentStatuses.map((item) => ({
        value: item,
        label: t(item),
      }))}
      onValueChange={(value) => {
        if (value) onChange(value)
      }}
    >
      <SelectTrigger aria-label={label} className="min-w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {employmentStatuses.map((item) => (
          <SelectItem key={item} value={item}>
            {t(item)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

type StatusSwitchProps = {
  status: EntityStatus
  label: string
  disabled?: boolean
  onChange: (status: EntityStatus) => void
}

export function StatusSwitch({
  status,
  label,
  disabled = false,
  onChange,
}: StatusSwitchProps) {
  return (
    <Switch
      checked={status === "active"}
      aria-label={label}
      disabled={disabled}
      onCheckedChange={(checked) => {
        onChange(checked ? "active" : "inactive")
      }}
    />
  )
}

export function CommandErrorMessage({
  error,
}: {
  error?: BackofficeErrorCode | undefined
}) {
  const t = useTranslations("backoffice.errors")
  return error ? (
    <p role="alert" className="text-body text-destructive-foreground">
      {t(error)}
    </p>
  ) : null
}

export function useBackofficeLabels() {
  const t = useTranslations("backoffice")
  const locale = useLocale()

  return {
    approvalType: (type: ApprovalType) => t(`approvalTypes.${type}`),
    employmentStatus: (status: EmploymentStatus) =>
      t(`employmentStatuses.${status}`),
    stepKind: (kind: ApprovalStepKind) => t(`stepKinds.${kind}`),
    assigneeMode: (mode: ApprovalAssigneeMode) => t(`assigneeModes.${mode}`),
    serviceType: (type: ServiceType) => t(`serviceTypes.${type}`),
    dateTime: (value: string) =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value)),
  }
}
