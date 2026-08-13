"use client"

import { RefreshCw, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, type ChangeEvent } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { RequestDialog } from "@/components/patterns/request-dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import { FormSelect } from "@/components/patterns/form-select"
import { approvalDocumentInputSchema } from "@/features/access-policies/model"
import {
  awsSecretKeySchema,
  awsSecretNameSchema,
  type ApiKey,
} from "@/features/credentials/model"
import type {
  ApprovalLine,
  ApprovalStep,
  ApprovalType,
  RequestTemplateField,
} from "@/features/request-templates/model"
import { resolveRequestOrganizationLeader } from "@/features/request-templates/approval-assignee"
import type { BackofficeErrorCode } from "@/domain/common"
import { useBackoffice } from "@/application/state/provider"
import {
  CommandErrorMessage,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

type LifecycleRequestType = Extract<
  ApprovalType,
  "api-key-replace" | "api-key-dispose"
>

export function ApiKeyLifecycleDialog({
  apiKey,
  template,
  type,
}: {
  apiKey: ApiKey
  template: ApprovalLine
  type: LifecycleRequestType
}) {
  const backoffice = useBackoffice()
  const session = useSessionAccess()
  const common = useTranslations("backoffice.common")
  const documentsT = useTranslations("backoffice.approvalDocuments")
  const t = useTranslations("backoffice.apiKeys")
  const labels = useBackofficeLabels()
  const requester = session.currentUser
  const defaultRequestOrganizationId = requester?.organizationIds[0] ?? null
  const [open, setOpen] = useState(false)
  const [requestOrganizationId, setRequestOrganizationId] = useState<
    string | null
  >(defaultRequestOrganizationId)
  const [content, setContent] = useState("")
  const [awsSecretName, setAwsSecretName] = useState(
    type === "api-key-replace" ? apiKey.awsSecretName : "",
  )
  const [awsSecretKey, setAwsSecretKey] = useState(
    type === "api-key-replace" ? apiKey.awsSecretKey : "",
  )
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [error, setError] = useState<BackofficeErrorCode>()

  if (
    template.category !== "credential" ||
    template.type !== type ||
    template.status !== "active"
  ) {
    throw new TypeError(`Invalid credential lifecycle template: ${template.id}`)
  }

  const service = backoffice.services.find(
    (item) => item.id === apiKey.serviceId,
  )
  if (!service) throw new Error(`Credential service not found: ${apiKey.id}`)
  const serviceOwnerOrganizationId = service.ownerOrganizationId
  const requestOrganization = backoffice.organizations.find(
    (item) => item.id === requestOrganizationId,
  )
  const requestOrganizationLeader = resolveRequestOrganizationLeader(
    backoffice,
    requestOrganizationId,
    requester?.id,
  )
  const organizationOptions = backoffice.organizations.filter((organization) =>
    requester?.organizationIds.includes(organization.id),
  )
  const assignmentCandidates = backoffice.users.filter(
    (user) =>
      user.employmentStatus === "employed" &&
      Boolean(
        requestOrganizationId &&
        user.organizationIds.includes(requestOrganizationId),
      ),
  )
  const assignmentsComplete = template.steps.every(
    (step) =>
      (step.assigneeMode !== "document-select" ||
        Boolean(assignments[step.id])) &&
      (step.assigneeMode !== "request-organization-leader" ||
        Boolean(requestOrganizationLeader)),
  )

  function reset() {
    setRequestOrganizationId(defaultRequestOrganizationId)
    setContent("")
    setAwsSecretName(type === "api-key-replace" ? apiKey.awsSecretName : "")
    setAwsSecretKey(type === "api-key-replace" ? apiKey.awsSecretKey : "")
    setCustomValues({})
    setAssignments({})
    setError(undefined)
  }

  function fieldIsComplete(field: RequestTemplateField) {
    if (!field.required) return true
    switch (field.binding) {
      case "service-id":
        return true
      case "key-name":
        return true
      case "aws-secret-name":
        return awsSecretNameSchema.safeParse(awsSecretName).success
      case "aws-secret-key":
        return awsSecretKeySchema.safeParse(awsSecretKey).success
      case "request-organization-id":
        return Boolean(requestOrganizationId)
      case "content":
        return content.trim().length >= 10
      case "custom":
        return Boolean(customValues[field.id]?.trim())
    }
  }

  const fieldsComplete = template.fields.every(fieldIsComplete)

  function resolveStepLabel(step: ApprovalStep) {
    switch (step.assigneeMode) {
      case "fixed-user":
        return backoffice.users.find((user) => user.id === step.userId)
          ?.nickname
      case "fixed-organization":
        return backoffice.organizations.find(
          (organization) => organization.id === step.organizationId,
        )?.name
      case "document-select":
        return labels.assigneeMode(step.assigneeMode)
      case "requester":
        return requester?.nickname
      case "request-organization-leader":
        return requestOrganizationLeader?.leader.nickname
      case "request-organization":
        return requestOrganization?.name
      case "service-owner-organization":
        return backoffice.organizations.find(
          (organization) => organization.id === serviceOwnerOrganizationId,
        )?.name
    }
  }

  function renderField(field: RequestTemplateField) {
    if (field.binding === "service-id" || field.binding === "key-name") {
      return null
    }
    if (field.binding === "aws-secret-name") {
      return (
        <Field key={field.id}>
          <FieldLabel htmlFor={`${type}-${field.id}`}>{field.label}</FieldLabel>
          <Input
            id={`${type}-${field.id}`}
            value={awsSecretName}
            required={field.required}
            pattern="[A-Za-z0-9/_+=.@-]+"
            maxLength={512}
            onChange={(event) => {
              setAwsSecretName(event.currentTarget.value)
            }}
          />
        </Field>
      )
    }
    if (field.binding === "aws-secret-key") {
      return (
        <Field key={field.id}>
          <FieldLabel htmlFor={`${type}-${field.id}`}>{field.label}</FieldLabel>
          <Input
            id={`${type}-${field.id}`}
            value={awsSecretKey}
            required={field.required}
            pattern="[A-Za-z0-9_.-]+"
            maxLength={128}
            onChange={(event) => {
              setAwsSecretKey(event.currentTarget.value)
            }}
          />
        </Field>
      )
    }
    if (field.binding === "request-organization-id") {
      return (
        <FormSelect
          key={field.id}
          label={field.label}
          value={requestOrganizationId}
          onValueChange={(value) => {
            setRequestOrganizationId(value)
            setAssignments({})
          }}
          options={organizationOptions.map((organization) => ({
            value: organization.id,
            label: organization.name,
          }))}
        />
      )
    }
    if (field.binding === "content") {
      return (
        <Field key={field.id}>
          <FieldLabel htmlFor={`${type}-${field.id}`}>{field.label}</FieldLabel>
          <Textarea
            id={`${type}-${field.id}`}
            value={content}
            required={field.required}
            minLength={field.required ? 10 : undefined}
            maxLength={5000}
            onChange={(event) => {
              setContent(event.currentTarget.value)
            }}
          />
        </Field>
      )
    }
    const id = `${type}-${field.id}`
    const sharedProps = {
      id,
      value: customValues[field.id] ?? "",
      required: field.required,
      maxLength: 5000,
      onChange: (
        event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => {
        setCustomValues((current) => ({
          ...current,
          [field.id]: event.currentTarget.value,
        }))
      },
    }
    return (
      <Field key={field.id}>
        <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
        {field.control === "textarea" ? (
          <Textarea {...sharedProps} />
        ) : (
          <Input {...sharedProps} />
        )}
      </Field>
    )
  }

  function renderFields() {
    return template.fields
      .toSorted((left, right) => left.order - right.order)
      .map(renderField)
  }

  async function submit() {
    const base = {
      title: t(
        type === "api-key-replace" ? "replacementTitle" : "disposalTitle",
        { keyName: apiKey.name },
      ),
      organizationId: requestOrganizationId,
      requesterId: requester?.id,
      approvalLineId: template.id,
      apiKeyId: apiKey.id,
      content,
      fieldValues: template.fields
        .filter((field) => field.binding === "custom")
        .map((field) => ({
          fieldId: field.id,
          value: customValues[field.id] ?? "",
        })),
      stepAssignments: Object.entries(assignments).map(([stepId, userId]) => ({
        stepId,
        userId,
      })),
      submission: "submitted",
    }
    const parsed = approvalDocumentInputSchema.safeParse(
      type === "api-key-replace"
        ? {
            ...base,
            documentKind: "api-key-lifecycle",
            type: "api-key-replace",
            awsSecretName,
            awsSecretKey,
          }
        : {
            ...base,
            documentKind: "api-key-lifecycle",
            type: "api-key-dispose",
          },
    )
    if (!parsed.success) {
      setError("invalid-input")
      return
    }
    const result = await backoffice.createApprovalDocument(parsed.data)
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t("lifecycleRequested"))
    setOpen(false)
    reset()
  }

  const isReplacement = type === "api-key-replace"
  return (
    <RequestDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) reset()
      }}
      triggerLabel={t(isReplacement ? "requestReplacement" : "requestDisposal")}
      triggerIcon={isReplacement ? RefreshCw : Trash2}
      title={t(
        isReplacement ? "replacementRequestTitle" : "disposalRequestTitle",
      )}
      description={t("lifecycleRequestDescription")}
      cancelLabel={common("cancel")}
      submitLabel={t("lifecycleSubmit")}
      submitDisabled={!requester || !fieldsComplete || !assignmentsComplete}
      onSubmit={submit}
    >
      <dl className="grid gap-3 rounded-lg border bg-surface-subtle p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">{t("keyName")}</dt>
          <dd className="mt-1 font-medium">{apiKey.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("service")}</dt>
          <dd className="mt-1 font-medium">{service.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            {documentsT("approvalLine")}
          </dt>
          <dd className="mt-1 font-medium">{template.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            {documentsT("requester")}
          </dt>
          <dd className="mt-1 font-medium">{requester?.nickname}</dd>
        </div>
      </dl>
      <div className="grid gap-4">{renderFields()}</div>
      <section className="grid gap-2" aria-label={documentsT("preview")}>
        {template.steps.map((step) => (
          <div
            key={step.id}
            className="grid gap-2 rounded-lg border bg-surface-subtle p-3 sm:grid-cols-[7rem_1fr] sm:items-center"
          >
            <span className="text-xs text-muted-foreground">
              {t("stage", { stage: step.stage })} · {labels.stepKind(step.kind)}
            </span>
            {step.assigneeMode === "document-select" ? (
              <FormSelect
                label={labels.assigneeMode(step.assigneeMode)}
                value={assignments[step.id] ?? null}
                onValueChange={(value) => {
                  if (!value) return
                  setAssignments((current) => ({
                    ...current,
                    [step.id]: value,
                  }))
                }}
                options={assignmentCandidates.map((user) => ({
                  value: user.id,
                  label: user.nickname,
                }))}
              />
            ) : (
              <span className="font-medium">{resolveStepLabel(step)}</span>
            )}
          </div>
        ))}
      </section>
      <CommandErrorMessage error={error} />
    </RequestDialog>
  )
}
