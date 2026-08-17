"use client"

import { requestCategoryValues } from "@/features/request-templates/model"
import { approvalAssigneeTypes } from "@/features/access-policies/model"
import type { ApprovalAssigneeType } from "@/features/access-policies/model"
import { employmentStatusValues } from "@/features/iam/model"
import { Copy, FlaskConical } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { useBackoffice } from "@/application/state/provider"
import { useSessionAccess } from "@/auth/session-access-provider"
import {
  CommandErrorMessage,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"
import {
  FormDialog,
  FormDialogContent,
} from "@/components/patterns/form-dialog"
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
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import type { BackofficeErrorCode } from "@/domain/common"
import type { ApprovalLine } from "@/features/request-templates/model"
import { previewRequestTemplate } from "@/features/request-templates/request-template-analysis"

export function RequestTemplateCloneDialog({
  template,
}: {
  template: ApprovalLine
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.approvalLines")
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<BackofficeErrorCode>()

  async function submit(form: HTMLFormElement) {
    const name = new FormData(form).get("name")
    if (typeof name !== "string") {
      setError("invalid-input")
      return
    }
    const result = await backoffice.cloneApprovalLine(
      template.id,
      name,
      sessionAccess.currentUser?.id ?? "",
    )
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t("cloned"))
    setOpen(false)
    router.push(`/approval-lines/${result.value.id}`)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        setError(undefined)
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <Copy />
        {t("clone")}
      </DialogTrigger>
      <FormDialogContent>
        <DialogHeader>
          <DialogTitle>{t("cloneTitle")}</DialogTitle>
          <DialogDescription>{t("cloneDescription")}</DialogDescription>
        </DialogHeader>
        <form
          id="request-template-clone-form"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(event.currentTarget)
          }}
        >
          <Field>
            <FieldLabel htmlFor="request-template-clone-name">
              {common("name")}
            </FieldLabel>
            <Input
              id="request-template-clone-name"
              name="name"
              defaultValue={`${template.name} ${t("copySuffix")}`}
              required
              minLength={2}
              maxLength={100}
            />
          </Field>
          <CommandErrorMessage error={error} />
        </form>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {common("cancel")}
          </DialogClose>
          <Button type="submit" form="request-template-clone-form">
            {t("clone")}
          </Button>
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}

export function RequestTemplatePreviewDialog({
  template,
}: {
  template: ApprovalLine
}) {
  const backoffice = useBackoffice()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.approvalLines")
  const labels = useBackofficeLabels()
  const employedUsers = backoffice.users.filter(
    (user) => user.employmentStatus === employmentStatusValues.employed,
  )
  const [requesterId, setRequesterId] = useState<string | null>(
    employedUsers[0]?.id ?? null,
  )
  const requester = backoffice.users.find((user) => user.id === requesterId)
  const availableOrganizations = backoffice.organizations.filter(
    (organization) => requester?.organizationIds.includes(organization.id),
  )
  const [organizationId, setOrganizationId] = useState<string | null>(
    availableOrganizations[0]?.id ?? null,
  )
  const [serviceId, setServiceId] = useState<string | null>(
    template.category === requestCategoryValues.credential
      ? (backoffice.services[0]?.id ?? null)
      : null,
  )
  const steps =
    requesterId && organizationId
      ? previewRequestTemplate(backoffice, template, {
          requesterId,
          requestOrganizationId: organizationId,
          serviceId,
        })
      : []

  function assigneeLabel(type: ApprovalAssigneeType, id: string | null) {
    if (!id) return t("unresolvedAssignee")
    return type === approvalAssigneeTypes.user
      ? (backoffice.users.find((user) => user.id === id)?.nickname ??
          t("unresolvedAssignee"))
      : (backoffice.organizations.find((organization) => organization.id === id)
          ?.name ?? t("unresolvedAssignee"))
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <FlaskConical />
        {t("preview")}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("previewTitle")}</DialogTitle>
          <DialogDescription>{t("previewDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect
            label={t("requester")}
            value={requesterId}
            onValueChange={(value) => {
              setRequesterId(value)
              const nextUser = backoffice.users.find(
                (user) => user.id === value,
              )
              setOrganizationId(nextUser?.organizationIds[0] ?? null)
            }}
            options={employedUsers.map((user) => ({
              value: user.id,
              label: user.nickname,
            }))}
          />
          <FormSelect
            label={t("requestOrganization")}
            value={organizationId}
            onValueChange={setOrganizationId}
            options={availableOrganizations.map((organization) => ({
              value: organization.id,
              label: organization.name,
            }))}
          />
          {template.category === requestCategoryValues.credential ? (
            <div className="sm:col-span-2">
              <FormSelect
                label={t("service")}
                value={serviceId}
                onValueChange={setServiceId}
                options={backoffice.services.map((service) => ({
                  value: service.id,
                  label: service.name,
                }))}
              />
            </div>
          ) : null}
        </div>
        <ol className="grid max-h-[26rem] gap-2 overflow-y-auto rounded-card border p-3">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className="flex min-h-14 items-start gap-3 rounded-control bg-surface-subtle p-3"
            >
              <Badge variant="outline">{index + 1}</Badge>
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {labels.stepKind(step.kind)}
                  </span>
                  {step.parallelWithPrevious ? (
                    <Badge variant="info">{t("parallel")}</Badge>
                  ) : null}
                </span>
                <span
                  className={
                    step.assigneeId
                      ? "text-sm"
                      : "text-sm text-destructive-foreground"
                  }
                >
                  {assigneeLabel(step.assigneeType, step.assigneeId)}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <DialogFooter>
          <DialogClose render={<Button />}>{common("close")}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
