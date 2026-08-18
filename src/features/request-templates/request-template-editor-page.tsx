"use client"

import { requestTemplateFieldControlValues } from "@/features/request-templates/model"
import { requestTemplateFieldBindingValues } from "@/features/request-templates/model"
import { approvalAssigneeModeValues } from "@/features/request-templates/model"
import { requestCategoryValues } from "@/features/request-templates/model"
import { approvalTypeValues } from "@/features/request-templates/model"
import { approvalExecutionTypeValues } from "@/features/request-templates/model"
import { approvalStepKindValues } from "@/features/request-templates/model"
import { employmentStatusValues } from "@/features/iam/model"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { PageHeader } from "@/components/patterns/page-header"
import { EmptyState } from "@/components/patterns/content-state"
import {
  FieldValidationMessage,
  useDynamicFormValidation,
} from "@/components/patterns/dynamic-form-validation"
import {
  ReviewWorkflowProgress,
  type ReviewWorkflowStep,
} from "@/components/patterns/review-workflow-progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import { FormSelect } from "@/components/patterns/form-select"
import {
  approvalTypes,
  approvalExecutionTypeSchema,
  approvalAssigneeModes,
  approvalStepKinds,
  requestCategories,
  type ApprovalAssigneeMode,
  type ApprovalExecutionType,
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
import { useSessionAccess } from "@/auth/session-access-provider"
import { approvalLineInputSchema } from "@/features/request-templates/model"
import {
  CommandErrorMessage,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"
import { resolveRequestTemplateImpact } from "@/features/request-templates/request-template-analysis"
import { cn } from "@/lib/utils"

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

const requestTemplateEditorModes = {
  create: "create",
  update: "update",
  clone: "clone",
} as const
type RequestTemplateEditorMode =
  (typeof requestTemplateEditorModes)[keyof typeof requestTemplateEditorModes]

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
    case requestTemplateFieldBindingValues.serviceId:
      return { ...base, binding: field.binding, control: "service-select" }
    case requestTemplateFieldBindingValues.requestOrganizationId:
      return {
        ...base,
        binding: field.binding,
        control: "organization-select",
      }
    case requestTemplateFieldBindingValues.keyName:
      return { ...base, binding: field.binding, control: "text" }
    case requestTemplateFieldBindingValues.awsSecretName:
      return { ...base, binding: field.binding, control: "text" }
    case requestTemplateFieldBindingValues.awsSecretKey:
      return { ...base, binding: field.binding, control: "text" }
    case requestTemplateFieldBindingValues.content:
      return { ...base, binding: field.binding, control: "textarea" }
    case requestTemplateFieldBindingValues.custom:
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
        userId:
          step.assigneeMode === approvalAssigneeModeValues.fixedUser
            ? step.userId
            : null,
        organizationId:
          step.assigneeMode === approvalAssigneeModeValues.fixedOrganization
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
          field.control === requestTemplateFieldControlValues.textarea ||
          field.control === requestTemplateFieldControlValues.text
            ? field.control
            : "text",
        required: field.required,
      })) ?? []
  )
}

export function RequestTemplateEditorPage({
  template,
  templateId,
  sourceTemplateId,
}: {
  template?: ApprovalLine
  templateId?: string
  sourceTemplateId?: string | undefined
}) {
  const backoffice = useBackoffice()
  const t = useTranslations("backoffice.approvalLines")
  const common = useTranslations("backoffice.common")
  const resolvedTemplate =
    template ??
    (templateId || sourceTemplateId
      ? backoffice.approvalLines.find(
          (item) => item.id === (templateId ?? sourceTemplateId),
        )
      : undefined)

  if ((templateId || sourceTemplateId) && !resolvedTemplate) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          <Button nativeButton={false} render={<Link href="/approval-lines" />}>
            {common("backToList")}
          </Button>
        }
      />
    )
  }

  return resolvedTemplate ? (
    <RequestTemplateEditorForm
      template={resolvedTemplate}
      mode={
        sourceTemplateId
          ? requestTemplateEditorModes.clone
          : requestTemplateEditorModes.update
      }
    />
  ) : (
    <RequestTemplateEditorForm />
  )
}

function RequestTemplateEditorForm({
  template,
  mode = requestTemplateEditorModes.create,
}: {
  template?: ApprovalLine
  mode?: RequestTemplateEditorMode
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const t = useTranslations("backoffice.approvalLines")
  const common = useTranslations("backoffice.common")
  const labels = useBackofficeLabels()
  const [step, setStep] = useState<ReviewWorkflowStep>(1)
  const [name, setName] = useState(
    template
      ? `${template.name}${mode === requestTemplateEditorModes.clone ? ` ${t("copySuffix")}` : ""}`
      : "",
  )
  const [category, setCategory] = useState<RequestCategory | null>(
    template?.category ?? null,
  )
  const [type, setType] = useState<ApprovalType | null>(template?.type ?? null)
  const [approvalExecutionType, setApprovalExecutionType] =
    useState<ApprovalExecutionType>(
      template?.approvalExecution.type ?? approvalExecutionTypeValues.internal,
    )
  const [grooDraftDocumentId, setGrooDraftDocumentId] = useState(
    template?.approvalExecution.type === approvalExecutionTypeValues.groo
      ? template.approvalExecution.draftDocumentId
      : "",
  )
  const [steps, setSteps] = useState<StepDraft[]>(() =>
    createStepDrafts(template),
  )
  const [fields, setFields] = useState<FieldDraft[]>(() =>
    createFieldDrafts(template),
  )
  const [error, setError] = useState<BackofficeErrorCode>()
  const employedUsers = backoffice.users.filter(
    (user) => user.employmentStatus === employmentStatusValues.employed,
  )
  const impact =
    template && mode === requestTemplateEditorModes.update
      ? resolveRequestTemplateImpact(backoffice, template)
      : null

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

  function parseInput() {
    const parsed = approvalLineInputSchema.safeParse({
      name,
      category,
      type,
      approvalExecution:
        approvalExecutionType === approvalExecutionTypeValues.groo
          ? {
              type: approvalExecutionTypeValues.groo,
              draftDocumentId: grooDraftDocumentId,
            }
          : { type: approvalExecutionTypeValues.internal },
      steps: steps.map((step) => {
        const base = {
          kind: step.kind,
          assigneeMode: step.assigneeMode,
          stage: step.stage,
        }
        if (step.assigneeMode === approvalAssigneeModeValues.fixedUser) {
          return { ...base, userId: step.userId }
        }
        if (
          step.assigneeMode === approvalAssigneeModeValues.fixedOrganization
        ) {
          return { ...base, organizationId: step.organizationId }
        }
        return base
      }),
      fields: fields.map(toFieldInput),
    })
    return parsed
  }

  async function submit() {
    const parsed = parseInput()
    if (!parsed.success) {
      validation.revealAll()
      return
    }
    if (step === 1) {
      setStep(2)
      setError(undefined)
      return
    }
    const requesterId = sessionAccess.currentUser?.id ?? ""
    const result = await (template && mode === requestTemplateEditorModes.update
      ? backoffice.updateApprovalLine(template.id, parsed.data, requesterId)
      : backoffice.createApprovalLine(parsed.data, requesterId))
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(
      t(
        mode === requestTemplateEditorModes.update
          ? "updated"
          : mode === requestTemplateEditorModes.clone
            ? "cloned"
            : "created",
      ),
    )
    router.replace(`/approval-lines/${result.value.id}`)
  }

  function assigneeLabel(stepDraft: StepDraft) {
    if (stepDraft.assigneeMode === approvalAssigneeModeValues.fixedUser) {
      return (
        employedUsers.find((user) => user.id === stepDraft.userId)?.nickname ??
        labels.assigneeMode(stepDraft.assigneeMode)
      )
    }
    if (
      stepDraft.assigneeMode === approvalAssigneeModeValues.fixedOrganization
    ) {
      return (
        backoffice.organizations.find(
          (organization) => organization.id === stepDraft.organizationId,
        )?.name ?? labels.assigneeMode(stepDraft.assigneeMode)
      )
    }
    return labels.assigneeMode(stepDraft.assigneeMode)
  }

  function renderReview() {
    return (
      <section className="grid gap-5" aria-labelledby="template-review-title">
        <div className="grid gap-1">
          <h3 id="template-review-title" className="text-base font-semibold">
            {t("reviewTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("reviewDescription")}
          </p>
        </div>
        <dl className="grid overflow-hidden rounded-card border sm:grid-cols-2">
          <div className="grid gap-1 border-b p-3 sm:col-span-2">
            <dt className="text-xs text-muted-foreground">{t("lineName")}</dt>
            <dd className="font-medium">{name}</dd>
          </div>
          <div className="grid gap-1 border-b p-3 sm:border-r">
            <dt className="text-xs text-muted-foreground">{t("category")}</dt>
            <dd className="font-medium">
              {category ? t(`categories.${category}`) : "—"}
            </dd>
          </div>
          <div className="grid gap-1 border-b p-3">
            <dt className="text-xs text-muted-foreground">{t("type")}</dt>
            <dd className="font-medium">
              {type ? labels.approvalType(type) : "—"}
            </dd>
          </div>
          <div
            className={cn(
              "grid gap-1 border-b p-3",
              approvalExecutionType === approvalExecutionTypeValues.groo
                ? "sm:border-r"
                : "sm:col-span-2",
            )}
          >
            <dt className="text-xs text-muted-foreground">
              {t("approvalExecution")}
            </dt>
            <dd className="font-medium">
              {t(`approvalExecutions.${approvalExecutionType}`)}
            </dd>
          </div>
          {approvalExecutionType === approvalExecutionTypeValues.groo ? (
            <div className="grid gap-1 border-b p-3">
              <dt className="text-xs text-muted-foreground">
                {t("grooDraftDocumentId")}
              </dt>
              <dd className="font-medium break-all">{grooDraftDocumentId}</dd>
            </div>
          ) : null}
          <div className="grid gap-1 p-3 sm:border-r">
            <dt className="text-xs text-muted-foreground">{t("stepCount")}</dt>
            <dd className="font-medium">{steps.length}</dd>
          </div>
          <div className="grid gap-1 p-3">
            <dt className="text-xs text-muted-foreground">{t("fieldCount")}</dt>
            <dd className="font-medium">{fields.length}</dd>
          </div>
        </dl>
        {impact ? (
          <Alert
            variant={impact.inFlightRequestIds.length > 0 ? "warning" : "info"}
          >
            <AlertTitle>{t("changeImpactTitle")}</AlertTitle>
            <AlertDescription className="flex flex-wrap gap-2 pt-2">
              <Badge variant="outline">
                {t("affectedServiceCount", { count: impact.serviceIds.length })}
              </Badge>
              <Badge variant="outline">
                {t("affectedPolicyCount", { count: impact.policyIds.length })}
              </Badge>
              <Badge
                variant={
                  impact.inFlightRequestIds.length > 0 ? "warning" : "secondary"
                }
              >
                {t("inFlightRequestCount", {
                  count: impact.inFlightRequestIds.length,
                })}
              </Badge>
            </AlertDescription>
          </Alert>
        ) : null}
        {approvalExecutionType === approvalExecutionTypeValues.internal ? (
          <section className="grid gap-2" aria-labelledby="review-steps-title">
            <h4 id="review-steps-title" className="font-medium">
              {t("configuredStepsTitle")}
            </h4>
            <ul className="grid gap-2">
              {steps.map((stepDraft, index) => (
                <li
                  key={stepDraft.id}
                  className="grid gap-1 rounded-control border bg-surface-subtle px-3 py-2 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                >
                  <Badge variant="secondary">{index + 1}</Badge>
                  <span className="font-medium">
                    {labels.stepKind(stepDraft.kind)} ·{" "}
                    {assigneeLabel(stepDraft)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("currentRequestStage", { stage: stepDraft.stage })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section className="grid gap-2" aria-labelledby="review-fields-title">
          <h4 id="review-fields-title" className="font-medium">
            {t("configuredFieldsTitle")}
          </h4>
          {fields.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {fields.map((field) => (
                <li
                  key={field.id}
                  className="grid gap-1 rounded-control border bg-surface-subtle px-3 py-2"
                >
                  <span className="font-medium">{field.label}</span>
                  <code className="text-xs text-text-subtle">{field.key}</code>
                  <span className="text-xs text-muted-foreground">
                    {t(`fieldBindings.${field.binding}`)} ·{" "}
                    {t(field.required ? "required" : "optional")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("configuredFieldsEmpty")}
            </p>
          )}
        </section>
      </section>
    )
  }

  const inputResult = parseInput()
  const validation = useDynamicFormValidation(
    inputResult.success ? undefined : inputResult.error,
  )
  const nameValidation = validation.getFieldValidation(
    "name",
    "line-name-error",
  )
  const categoryValidation = validation.getFieldValidation(
    "category",
    "line-category-error",
  )
  const typeValidation = validation.getFieldValidation(
    "type",
    "line-type-error",
  )
  const executionValidation = validation.getFieldValidation(
    "approvalExecution.type",
    "line-execution-error",
  )
  const grooDocumentValidation = validation.getFieldValidation(
    "approvalExecution.draftDocumentId",
    "groo-draft-document-id-error",
  )
  const stepsValidation = validation.getFieldValidation(
    "steps",
    "line-steps-error",
  )
  const fieldsValidation = validation.getFieldValidation(
    "fields",
    "line-fields-error",
  )
  const inputValid = inputResult.success

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6">
      <PageHeader
        title={t(
          mode === requestTemplateEditorModes.update
            ? "editTitle"
            : mode === requestTemplateEditorModes.clone
              ? "cloneTitle"
              : "builderTitle",
        )}
        description={t(
          mode === requestTemplateEditorModes.clone
            ? "cloneDescription"
            : "builderDescription",
        )}
      />
      <Card>
        <CardContent className="grid gap-5">
          <ReviewWorkflowProgress step={step} label={t("workflowProgress")} />
          <form
            noValidate
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            {step === 1 ? (
              <>
                <div className="grid gap-4">
                  <Field invalid={nameValidation.invalid}>
                    <FieldLabel htmlFor="line-name">{t("lineName")}</FieldLabel>
                    <Input
                      id="line-name"
                      name="name"
                      value={name}
                      required
                      minLength={2}
                      maxLength={100}
                      aria-invalid={nameValidation.invalid}
                      aria-describedby={nameValidation.errorId}
                      onChange={(event) => {
                        validation.touch("name")
                        setName(event.currentTarget.value)
                      }}
                    />
                    <FieldValidationMessage validation={nameValidation} />
                  </Field>
                  <FormSelect
                    label={t("category")}
                    value={category}
                    error={categoryValidation.error}
                    onInteract={() => {
                      validation.touch("category")
                    }}
                    onValueChange={(value) => {
                      setCategory(value)
                      setType(null)
                      if (value === requestCategoryValues.permission) {
                        setSteps((current) =>
                          current.map((step) =>
                            step.assigneeMode ===
                            approvalAssigneeModeValues.serviceOwnerOrganization
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
                    error={typeValidation.error}
                    onInteract={() => {
                      validation.touch("type")
                    }}
                    options={approvalTypes
                      .filter((item) =>
                        category === requestCategoryValues.credential
                          ? item.startsWith("api-key")
                          : category === requestCategoryValues.permission
                            ? !item.startsWith("api-key")
                            : false,
                      )
                      .map((item) => ({
                        value: item,
                        label: labels.approvalType(item),
                      }))}
                  />
                  <FormSelect
                    label={t("approvalExecution")}
                    value={approvalExecutionType}
                    error={executionValidation.error}
                    onInteract={() => {
                      validation.touch("approvalExecution.type")
                    }}
                    onValueChange={(value) => {
                      if (!value) return
                      setApprovalExecutionType(value)
                      if (value === approvalExecutionTypeValues.groo) {
                        setSteps([])
                      } else if (steps.length === 0) {
                        setSteps([
                          {
                            id: crypto.randomUUID(),
                            kind: approvalStepKindValues.request,
                            assigneeMode: approvalAssigneeModeValues.requester,
                            stage: 1,
                            userId: employedUsers[0]?.id ?? null,
                            organizationId:
                              backoffice.organizations[0]?.id ?? null,
                          },
                        ])
                      }
                    }}
                    options={approvalExecutionTypeSchema.options.map(
                      (item) => ({
                        value: item,
                        label: t(`approvalExecutions.${item}`),
                      }),
                    )}
                  />
                  {approvalExecutionType ===
                  approvalExecutionTypeValues.groo ? (
                    <Field invalid={grooDocumentValidation.invalid}>
                      <FieldLabel htmlFor="groo-draft-document-id">
                        {t("grooDraftDocumentId")}
                      </FieldLabel>
                      <Input
                        id="groo-draft-document-id"
                        value={grooDraftDocumentId}
                        required
                        maxLength={200}
                        pattern="\\S+"
                        aria-invalid={grooDocumentValidation.invalid}
                        aria-describedby={grooDocumentValidation.errorId}
                        onChange={(event) => {
                          validation.touch("approvalExecution.draftDocumentId")
                          setGrooDraftDocumentId(event.currentTarget.value)
                        }}
                      />
                      <FieldValidationMessage
                        validation={grooDocumentValidation}
                      />
                    </Field>
                  ) : null}
                </div>

                {approvalExecutionType ===
                approvalExecutionTypeValues.internal ? (
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
                    {steps.map((step, index) => {
                      const stepPath = `steps.${String(index)}`
                      const stageValidation = validation.getFieldValidation(
                        `${stepPath}.stage`,
                        `${step.id}-stage-error`,
                      )
                      const kindValidation = validation.getFieldValidation(
                        `${stepPath}.kind`,
                        `${step.id}-kind-error`,
                      )
                      const assigneeModeValidation =
                        validation.getFieldValidation(
                          `${stepPath}.assigneeMode`,
                          `${step.id}-assignee-mode-error`,
                        )
                      const assigneeValidation = validation.getFieldValidation(
                        step.assigneeMode ===
                          approvalAssigneeModeValues.fixedUser
                          ? `${stepPath}.userId`
                          : `${stepPath}.organizationId`,
                        `${step.id}-assignee-error`,
                      )
                      return (
                        <div
                          key={step.id}
                          className="grid items-end gap-2 rounded-lg border bg-surface-subtle p-3 md:grid-cols-[auto_6rem_1fr_1fr_1fr_auto]"
                        >
                          <span className="pb-2 font-semibold tabular-nums">
                            {index + 1}
                          </span>
                          <Field invalid={stageValidation.invalid}>
                            <FieldLabel htmlFor={`${step.id}-stage`}>
                              {t("stageLabel")}
                            </FieldLabel>
                            <Input
                              id={`${step.id}-stage`}
                              type="number"
                              min={1}
                              max={12}
                              value={step.stage}
                              aria-invalid={stageValidation.invalid}
                              aria-describedby={stageValidation.errorId}
                              onChange={(event) => {
                                validation.touch(`${stepPath}.stage`)
                                const stage = event.currentTarget.valueAsNumber
                                setSteps((current) =>
                                  current.map((item) =>
                                    item.id === step.id
                                      ? { ...item, stage }
                                      : item,
                                  ),
                                )
                              }}
                            />
                            <FieldValidationMessage
                              validation={stageValidation}
                            />
                          </Field>
                          <FormSelect
                            label={t("step")}
                            value={step.kind}
                            error={kindValidation.error}
                            onInteract={() => {
                              validation.touch(`${stepPath}.kind`)
                            }}
                            onValueChange={(value) => {
                              if (!value) return
                              setSteps((current) =>
                                current.map((item) =>
                                  item.id === step.id
                                    ? { ...item, kind: value }
                                    : item,
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
                            error={assigneeModeValidation.error}
                            onInteract={() => {
                              validation.touch(`${stepPath}.assigneeMode`)
                            }}
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
                                  category ===
                                    requestCategoryValues.credential ||
                                  item !==
                                    approvalAssigneeModeValues.serviceOwnerOrganization,
                              )
                              .map((item) => ({
                                value: item,
                                label: labels.assigneeMode(item),
                              }))}
                          />
                          {step.assigneeMode ===
                          approvalAssigneeModeValues.fixedUser ? (
                            <FormSelect
                              label={t("assignee")}
                              value={step.userId}
                              error={assigneeValidation.error}
                              onInteract={() => {
                                validation.touch(`${stepPath}.userId`)
                              }}
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
                          ) : step.assigneeMode ===
                            approvalAssigneeModeValues.fixedOrganization ? (
                            <FormSelect
                              label={t("assignee")}
                              value={step.organizationId}
                              error={assigneeValidation.error}
                              onInteract={() => {
                                validation.touch(`${stepPath}.organizationId`)
                              }}
                              onValueChange={(value) => {
                                setSteps((current) =>
                                  current.map((item) =>
                                    item.id === step.id
                                      ? { ...item, organizationId: value }
                                      : item,
                                  ),
                                )
                              }}
                              options={backoffice.organizations.map(
                                (organization) => ({
                                  value: organization.id,
                                  label: organization.name,
                                }),
                              )}
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
                                validation.touch("steps")
                                setSteps((current) =>
                                  current.filter((item) => item.id !== step.id),
                                )
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                    <FieldValidationMessage validation={stepsValidation} />
                  </section>
                ) : null}

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
                  {fields.map((field, index) => {
                    const fieldPath = `fields.${String(index)}`
                    const keyValidation = validation.getFieldValidation(
                      `${fieldPath}.key`,
                      `${field.id}-key-error`,
                    )
                    const labelValidation = validation.getFieldValidation(
                      `${fieldPath}.label`,
                      `${field.id}-label-error`,
                    )
                    const bindingValidation = validation.getFieldValidation(
                      `${fieldPath}.binding`,
                      `${field.id}-binding-error`,
                    )
                    const controlValidation = validation.getFieldValidation(
                      `${fieldPath}.control`,
                      `${field.id}-control-error`,
                    )
                    return (
                      <div
                        key={field.id}
                        className="grid items-end gap-3 rounded-lg border bg-surface-subtle p-3 md:grid-cols-[auto_1fr_1fr_1fr_1fr_auto]"
                      >
                        <span className="pb-2 font-semibold tabular-nums">
                          {index + 1}
                        </span>
                        <Field invalid={keyValidation.invalid}>
                          <FieldLabel htmlFor={`${field.id}-key`}>
                            {t("fieldKey")}
                          </FieldLabel>
                          <Input
                            id={`${field.id}-key`}
                            value={field.key}
                            required
                            pattern="[a-z]+(?:-[a-z]+)*"
                            maxLength={60}
                            aria-invalid={keyValidation.invalid}
                            aria-describedby={keyValidation.errorId}
                            onChange={(event) => {
                              validation.touch(`${fieldPath}.key`)
                              const key = event.currentTarget.value
                              setFields((current) =>
                                current.map((item) =>
                                  item.id === field.id
                                    ? { ...item, key }
                                    : item,
                                ),
                              )
                            }}
                          />
                          <FieldValidationMessage validation={keyValidation} />
                        </Field>
                        <Field invalid={labelValidation.invalid}>
                          <FieldLabel htmlFor={`${field.id}-label`}>
                            {t("fieldLabel")}
                          </FieldLabel>
                          <Input
                            id={`${field.id}-label`}
                            value={field.label}
                            required
                            maxLength={80}
                            aria-invalid={labelValidation.invalid}
                            aria-describedby={labelValidation.errorId}
                            onChange={(event) => {
                              validation.touch(`${fieldPath}.label`)
                              const label = event.currentTarget.value
                              setFields((current) =>
                                current.map((item) =>
                                  item.id === field.id
                                    ? { ...item, label }
                                    : item,
                                ),
                              )
                            }}
                          />
                          <FieldValidationMessage
                            validation={labelValidation}
                          />
                        </Field>
                        <FormSelect
                          label={t("fieldBinding")}
                          value={field.binding}
                          error={bindingValidation.error}
                          onInteract={() => {
                            validation.touch(`${fieldPath}.binding`)
                          }}
                          onValueChange={(binding) => {
                            if (!binding) return
                            setFields((current) =>
                              current.map((item) =>
                                item.id === field.id
                                  ? { ...item, binding }
                                  : item,
                              ),
                            )
                          }}
                          options={fieldBindings
                            .filter(
                              (item) =>
                                (item !==
                                  requestTemplateFieldBindingValues.awsSecretName &&
                                  item !==
                                    requestTemplateFieldBindingValues.awsSecretKey) ||
                                type === approvalTypeValues.apiKey ||
                                type === approvalTypeValues.apiKeyReplace,
                            )
                            .map((item) => ({
                              value: item,
                              label: t(`fieldBindings.${item}`),
                            }))}
                        />
                        {field.binding ===
                        requestTemplateFieldBindingValues.custom ? (
                          <FormSelect
                            label={t("fieldControl")}
                            value={field.control}
                            error={controlValidation.error}
                            onInteract={() => {
                              validation.touch(`${fieldPath}.control`)
                            }}
                            onValueChange={(control) => {
                              if (!control) return
                              setFields((current) =>
                                current.map((item) =>
                                  item.id === field.id
                                    ? { ...item, control }
                                    : item,
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
                                  item.id === field.id
                                    ? { ...item, required }
                                    : item,
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
                              validation.touch("fields")
                              setFields((current) =>
                                current.filter((item) => item.id !== field.id),
                              )
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                  {fieldsValidation.error ? (
                    <FieldError id={fieldsValidation.errorId}>
                      {fieldsValidation.error}
                    </FieldError>
                  ) : null}
                </section>
              </>
            ) : (
              renderReview()
            )}
            <CommandErrorMessage error={error} />
            <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-4">
              <Button
                type="button"
                variant="outline"
                nativeButton={false}
                render={
                  <Link
                    href={
                      template
                        ? `/approval-lines/${template.id}`
                        : "/approval-lines"
                    }
                  />
                }
              >
                {common("cancel")}
              </Button>
              {step === 2 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep(1)
                    setError(undefined)
                  }}
                >
                  {common("previous")}
                </Button>
              ) : null}
              <Button type="submit" disabled={step === 2 && !inputValid}>
                {step === 1
                  ? common("next")
                  : t(
                      mode === requestTemplateEditorModes.update
                        ? "saveChanges"
                        : mode === requestTemplateEditorModes.clone
                          ? "clone"
                          : "create",
                    )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
