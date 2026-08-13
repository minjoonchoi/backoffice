"use client"

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import {
  FormDialog,
  FormDialogContent,
} from "@/components/patterns/form-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import { FormSelect as FormSelect } from "@/components/patterns/form-select"
import {
  approvalTypes,
  approvalAssigneeModes,
  approvalStepKinds,
  requestCategories,
  type ApprovalAssigneeMode,
  type ApprovalLine,
  type ApprovalStepKind,
  type ApprovalType,
  type RequestCategory,
  type RequestTemplateFieldBinding,
  type RequestTemplateFieldControl,
  type RequestTemplateFieldInput,
} from "@/features/request-templates/model"
import type { BackofficeErrorCode } from "@/domain/common"
import { useBackoffice } from "@/application/state/provider"
import { approvalLineInputSchema } from "@/features/request-templates/model"
import {
  CommandErrorMessage,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

type StepDraft = {
  id: string
  kind: ApprovalStepKind
  assigneeMode: ApprovalAssigneeMode
  stage: number
  userId: string | null
  organizationId: string | null
}

type FieldDraft = {
  id: string
  key: string
  label: string
  binding: RequestTemplateFieldBinding
  control: "text" | "textarea"
  required: boolean
}

const fieldBindings: RequestTemplateFieldBinding[] = [
  "service-id",
  "request-organization-id",
  "key-name",
  "aws-secret-name",
  "aws-secret-key",
  "content",
  "custom",
]
const customFieldControls: Extract<
  RequestTemplateFieldControl,
  "text" | "textarea"
>[] = ["text", "textarea"]

function toFieldInput(field: FieldDraft): RequestTemplateFieldInput {
  const base = {
    key: field.key,
    label: field.label,
    required: field.required,
  }
  switch (field.binding) {
    case "service-id":
      return { ...base, binding: field.binding, control: "service-select" }
    case "request-organization-id":
      return {
        ...base,
        binding: field.binding,
        control: "organization-select",
      }
    case "key-name":
      return { ...base, binding: field.binding, control: "text" }
    case "aws-secret-name":
      return { ...base, binding: field.binding, control: "text" }
    case "aws-secret-key":
      return { ...base, binding: field.binding, control: "text" }
    case "content":
      return { ...base, binding: field.binding, control: "textarea" }
    case "custom":
      return { ...base, binding: field.binding, control: field.control }
  }
}

function createStepDrafts(template?: ApprovalLine): StepDraft[] {
  return (
    template?.steps
      .toSorted((left, right) => left.order - right.order)
      .map((step) => ({
        id: step.id,
        kind: step.kind,
        assigneeMode: step.assigneeMode,
        stage: step.stage,
        userId: step.assigneeMode === "fixed-user" ? step.userId : null,
        organizationId:
          step.assigneeMode === "fixed-organization"
            ? step.organizationId
            : null,
      })) ?? []
  )
}

function createFieldDrafts(template?: ApprovalLine): FieldDraft[] {
  return (
    template?.fields
      .toSorted((left, right) => left.order - right.order)
      .map((field) => ({
        id: field.id,
        key: field.key,
        label: field.label,
        binding: field.binding,
        control:
          field.control === "textarea" || field.control === "text"
            ? field.control
            : "text",
        required: field.required,
      })) ?? []
  )
}

export function RequestTemplateEditorDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: ApprovalLine
}) {
  const backoffice = useBackoffice()
  const t = useTranslations("backoffice.approvalLines")
  const labels = useBackofficeLabels()
  const [category, setCategory] = useState<RequestCategory | null>(
    template?.category ?? null,
  )
  const [type, setType] = useState<ApprovalType | null>(template?.type ?? null)
  const [steps, setSteps] = useState<StepDraft[]>(() =>
    createStepDrafts(template),
  )
  const [fields, setFields] = useState<FieldDraft[]>(() =>
    createFieldDrafts(template),
  )
  const [error, setError] = useState<BackofficeErrorCode>()
  const employedUsers = backoffice.users.filter(
    (user) => user.employmentStatus === "employed",
  )

  function addStep() {
    if (steps.length >= 12) return
    const previous = steps.at(-1)
    const first = steps.length === 0
    setSteps((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        kind: first ? "request" : "approval",
        assigneeMode: first ? "requester" : "document-select",
        stage: first ? 1 : Math.min((previous?.stage ?? 0) + 1, 12),
        userId: employedUsers[0]?.id ?? null,
        organizationId: backoffice.organizations[0]?.id ?? null,
      },
    ])
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= steps.length) return
    setSteps((current) => {
      const next = [...current]
      const selected = next[index]
      const displaced = next[target]
      if (!selected || !displaced) return current
      next[index] = { ...displaced, stage: selected.stage }
      next[target] = { ...selected, stage: displaced.stage }
      return next
    })
  }

  function addField() {
    if (fields.length >= 30) return
    setFields((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        key: "",
        label: "",
        binding: "custom",
        control: "text",
        required: true,
      },
    ])
  }

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const parsed = approvalLineInputSchema.safeParse({
      name: data.get("name"),
      category,
      type,
      steps: steps.map((step) => {
        const base = {
          kind: step.kind,
          assigneeMode: step.assigneeMode,
          stage: step.stage,
        }
        if (step.assigneeMode === "fixed-user") {
          return { ...base, userId: step.userId }
        }
        if (step.assigneeMode === "fixed-organization") {
          return { ...base, organizationId: step.organizationId }
        }
        return base
      }),
      fields: fields.map(toFieldInput),
    })
    if (!parsed.success) {
      setError("invalid-input")
      return
    }
    const result = await (template
      ? backoffice.updateApprovalLine(template.id, parsed.data)
      : backoffice.createApprovalLine(parsed.data))
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t(template ? "updated" : "created"))
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      hasChanges={
        category !== (template?.category ?? null) ||
        type !== (template?.type ?? null) ||
        JSON.stringify(steps) !== JSON.stringify(createStepDrafts(template)) ||
        JSON.stringify(fields) !== JSON.stringify(createFieldDrafts(template))
      }
    >
      <FormDialogContent className="max-h-[min(90svh,56rem)] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t(template ? "editTitle" : "builderTitle")}
          </DialogTitle>
          <DialogDescription>{t("builderDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(event.currentTarget)
          }}
        >
          <div className="grid gap-4">
            <Field>
              <FieldLabel htmlFor="line-name">{t("lineName")}</FieldLabel>
              <Input
                id="line-name"
                name="name"
                defaultValue={template?.name}
                required
                maxLength={100}
              />
            </Field>
            <FormSelect
              label={t("category")}
              value={category}
              onValueChange={(value) => {
                setCategory(value)
                setType(null)
                if (value === "permission") {
                  setSteps((current) =>
                    current.map((step) =>
                      step.assigneeMode === "service-owner-organization"
                        ? { ...step, assigneeMode: "document-select" }
                        : step,
                    ),
                  )
                }
              }}
              options={requestCategories.map((item) => ({
                value: item,
                label: t(`categories.${item}`),
              }))}
            />
            <FormSelect
              label={t("type")}
              value={type}
              onValueChange={setType}
              options={approvalTypes
                .filter((item) =>
                  category === "credential"
                    ? item.startsWith("api-key")
                    : category === "permission"
                      ? !item.startsWith("api-key")
                      : false,
                )
                .map((item) => ({
                  value: item,
                  label: labels.approvalType(item),
                }))}
            />
          </div>

          <section aria-labelledby="steps-title" className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 id="steps-title" className="font-medium">
                {t("preview")}
              </h3>
              <Button
                type="button"
                variant="outline"
                onClick={addStep}
                disabled={steps.length >= 12}
              >
                <Plus />
                {t("addStep")}
              </Button>
            </div>
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="grid items-end gap-2 rounded-lg border bg-surface-subtle p-3 md:grid-cols-[auto_6rem_1fr_1fr_1fr_auto]"
              >
                <span className="pb-2 font-semibold tabular-nums">
                  {index + 1}
                </span>
                <Field>
                  <FieldLabel htmlFor={`${step.id}-stage`}>
                    {t("stageLabel")}
                  </FieldLabel>
                  <Input
                    id={`${step.id}-stage`}
                    type="number"
                    min={1}
                    max={12}
                    value={step.stage}
                    onChange={(event) => {
                      const stage = event.currentTarget.valueAsNumber
                      setSteps((current) =>
                        current.map((item) =>
                          item.id === step.id ? { ...item, stage } : item,
                        ),
                      )
                    }}
                  />
                </Field>
                <FormSelect
                  label={t("step")}
                  value={step.kind}
                  onValueChange={(value) => {
                    if (!value) return
                    setSteps((current) =>
                      current.map((item) =>
                        item.id === step.id ? { ...item, kind: value } : item,
                      ),
                    )
                  }}
                  options={approvalStepKinds.map((item) => ({
                    value: item,
                    label: labels.stepKind(item),
                  }))}
                />
                <FormSelect
                  label={t("assigneeMode")}
                  value={step.assigneeMode}
                  onValueChange={(value) => {
                    if (!value) return
                    setSteps((current) =>
                      current.map((item) =>
                        item.id === step.id
                          ? { ...item, assigneeMode: value }
                          : item,
                      ),
                    )
                  }}
                  options={approvalAssigneeModes
                    .filter(
                      (item) =>
                        category === "credential" ||
                        item !== "service-owner-organization",
                    )
                    .map((item) => ({
                      value: item,
                      label: labels.assigneeMode(item),
                    }))}
                />
                {step.assigneeMode === "fixed-user" ? (
                  <FormSelect
                    label={t("assignee")}
                    value={step.userId}
                    onValueChange={(value) => {
                      setSteps((current) =>
                        current.map((item) =>
                          item.id === step.id
                            ? { ...item, userId: value }
                            : item,
                        ),
                      )
                    }}
                    options={employedUsers.map((user) => ({
                      value: user.id,
                      label: user.nickname,
                    }))}
                  />
                ) : step.assigneeMode === "fixed-organization" ? (
                  <FormSelect
                    label={t("assignee")}
                    value={step.organizationId}
                    onValueChange={(value) => {
                      setSteps((current) =>
                        current.map((item) =>
                          item.id === step.id
                            ? { ...item, organizationId: value }
                            : item,
                        ),
                      )
                    }}
                    options={backoffice.organizations.map((organization) => ({
                      value: organization.id,
                      label: organization.name,
                    }))}
                  />
                ) : (
                  <div className="pb-2 text-sm text-muted-foreground">
                    {labels.assigneeMode(step.assigneeMode)}
                  </div>
                )}
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${String(index + 1)} ${t("moveUp")}`}
                    disabled={index === 0}
                    onClick={() => {
                      move(index, -1)
                    }}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${String(index + 1)} ${t("moveDown")}`}
                    disabled={index === steps.length - 1}
                    onClick={() => {
                      move(index, 1)
                    }}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${String(index + 1)} ${t("removeStep")}`}
                    onClick={() => {
                      setSteps((current) =>
                        current.filter((item) => item.id !== step.id),
                      )
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </section>

          <section aria-labelledby="fields-title" className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 id="fields-title" className="font-medium">
                  {t("fieldsTitle")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("fieldsDescription")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addField}
                disabled={fields.length >= 30}
              >
                <Plus />
                {t("addField")}
              </Button>
            </div>
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid items-end gap-3 rounded-lg border bg-surface-subtle p-3 md:grid-cols-[auto_1fr_1fr_1fr_1fr_auto]"
              >
                <span className="pb-2 font-semibold tabular-nums">
                  {index + 1}
                </span>
                <Field>
                  <FieldLabel htmlFor={`${field.id}-key`}>
                    {t("fieldKey")}
                  </FieldLabel>
                  <Input
                    id={`${field.id}-key`}
                    value={field.key}
                    required
                    pattern="[a-z]+(?:-[a-z]+)*"
                    maxLength={60}
                    onChange={(event) => {
                      const key = event.currentTarget.value
                      setFields((current) =>
                        current.map((item) =>
                          item.id === field.id ? { ...item, key } : item,
                        ),
                      )
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${field.id}-label`}>
                    {t("fieldLabel")}
                  </FieldLabel>
                  <Input
                    id={`${field.id}-label`}
                    value={field.label}
                    required
                    maxLength={80}
                    onChange={(event) => {
                      const label = event.currentTarget.value
                      setFields((current) =>
                        current.map((item) =>
                          item.id === field.id ? { ...item, label } : item,
                        ),
                      )
                    }}
                  />
                </Field>
                <FormSelect
                  label={t("fieldBinding")}
                  value={field.binding}
                  onValueChange={(binding) => {
                    if (!binding) return
                    setFields((current) =>
                      current.map((item) =>
                        item.id === field.id ? { ...item, binding } : item,
                      ),
                    )
                  }}
                  options={fieldBindings
                    .filter(
                      (item) =>
                        (item !== "aws-secret-name" &&
                          item !== "aws-secret-key") ||
                        type === "api-key" ||
                        type === "api-key-replace",
                    )
                    .map((item) => ({
                      value: item,
                      label: t(`fieldBindings.${item}`),
                    }))}
                />
                {field.binding === "custom" ? (
                  <FormSelect
                    label={t("fieldControl")}
                    value={field.control}
                    onValueChange={(control) => {
                      if (!control) return
                      setFields((current) =>
                        current.map((item) =>
                          item.id === field.id ? { ...item, control } : item,
                        ),
                      )
                    }}
                    options={customFieldControls.map((item) => ({
                      value: item,
                      label: t(`fieldControls.${item}`),
                    }))}
                  />
                ) : (
                  <div className="pb-2 text-sm text-muted-foreground">
                    {t(`fieldBindings.${field.binding}`)}
                  </div>
                )}
                <div className="flex items-center gap-2 pb-2">
                  <Checkbox
                    id={`${field.id}-required`}
                    checked={field.required}
                    onCheckedChange={(required) => {
                      setFields((current) =>
                        current.map((item) =>
                          item.id === field.id ? { ...item, required } : item,
                        ),
                      )
                    }}
                  />
                  <FieldLabel htmlFor={`${field.id}-required`}>
                    {t("fieldRequired")}
                  </FieldLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${String(index + 1)} ${t("removeField")}`}
                    onClick={() => {
                      setFields((current) =>
                        current.filter((item) => item.id !== field.id),
                      )
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </section>
          <CommandErrorMessage error={error} />
          <Button
            type="submit"
            className="justify-self-end"
            disabled={!category || !type || steps.length === 0}
          >
            {t(template ? "saveChanges" : "create")}
          </Button>
        </form>
      </FormDialogContent>
    </FormDialog>
  )
}
