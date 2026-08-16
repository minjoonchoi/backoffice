"use client"

import { requestTemplateFieldControlValues } from "@/features/request-templates/model"
import { requestTemplateFieldBindingValues } from "@/features/request-templates/model"
import { requestCategoryValues } from "@/features/request-templates/model"
import { approvalTypeValues } from "@/features/request-templates/model"
import { entityStatuses } from "@/domain/common"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState, type ChangeEvent } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { resolveCredentialVisibility } from "@/auth/credential-access"
import { EmptyState } from "@/components/patterns/content-state"
import { RequestWorkflow } from "@/components/patterns/request-workflow"
import {
  ReviewWorkflowProgress,
  type ReviewWorkflowStep,
} from "@/components/patterns/review-workflow-progress"
import { Button } from "@/components/ui/button"
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
  ApprovalType,
  RequestTemplateField,
} from "@/features/request-templates/model"
import { RequestApprovalLineEditor } from "@/features/request-templates/request-approval-line-editor"
import {
  createRequestApprovalLineDraft,
  requestApprovalLineDraftIsComplete,
  toRequestApprovalStepInputs,
  type RequestApprovalStepDraft,
} from "@/features/request-templates/request-approval-line"
import type { BackofficeErrorCode } from "@/domain/common"
import { useBackoffice } from "@/application/state/provider"
import { CommandErrorMessage } from "@/application/ui/backoffice-ui"

type LifecycleRequestType = Extract<
  ApprovalType,
  "api-key-replace" | "api-key-dispose"
>

type CredentialLifecycleRequestPageProps =
  | {
      apiKey: ApiKey
      template: ApprovalLine
      apiKeyId?: never
      type: LifecycleRequestType
    }
  | {
      apiKey?: never
      template?: never
      apiKeyId: string
      type: LifecycleRequestType
    }

export function CredentialLifecycleRequestPage(
  props: CredentialLifecycleRequestPageProps,
) {
  const backoffice = useBackoffice()
  const session = useSessionAccess()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.apiKeys")
  const apiKey =
    props.apiKey ??
    resolveCredentialVisibility(
      backoffice,
      session.currentUser?.id ?? null,
    ).credentials.find((item) => item.credential.id === props.apiKeyId)
      ?.credential
  const service = apiKey
    ? backoffice.services.find((item) => item.id === apiKey.serviceId)
    : undefined
  const templateId = service
    ? props.type === approvalTypeValues.apiKeyReplace
      ? service.credentialTemplateIds.replacement
      : service.credentialTemplateIds.disposal
    : undefined
  const template =
    props.template ??
    backoffice.approvalLines.find((item) => item.id === templateId)

  if (!apiKey || !service || !template) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          <Button nativeButton={false} render={<Link href="/credentials" />}>
            {common("backToList")}
          </Button>
        }
      />
    )
  }

  return (
    <CredentialLifecycleRequestForm
      apiKey={apiKey}
      template={template}
      type={props.type}
    />
  )
}

function CredentialLifecycleRequestForm({
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
  const router = useRouter()
  const common = useTranslations("backoffice.common")
  const documentsT = useTranslations("backoffice.approvalDocuments")
  const t = useTranslations("backoffice.apiKeys")
  const requester = session.currentUser
  const defaultRequestOrganizationId = requester?.organizationIds[0] ?? null
  const [requestOrganizationId, setRequestOrganizationId] = useState<
    string | null
  >(defaultRequestOrganizationId)
  const [content, setContent] = useState("")
  const [awsSecretName, setAwsSecretName] = useState(
    type === approvalTypeValues.apiKeyReplace ? apiKey.awsSecretName : "",
  )
  const [awsSecretKey, setAwsSecretKey] = useState(
    type === approvalTypeValues.apiKeyReplace ? apiKey.awsSecretKey : "",
  )
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [approvalSteps, setApprovalSteps] = useState<
    RequestApprovalStepDraft[]
  >(() =>
    createRequestApprovalLineDraft(backoffice, template, {
      requesterId: requester?.id,
      requestOrganizationId: defaultRequestOrganizationId,
      serviceOwnerOrganizationId: backoffice.services.find(
        (item) => item.id === apiKey.serviceId,
      )?.ownerOrganizationId,
    }),
  )
  const [error, setError] = useState<BackofficeErrorCode>()
  const [step, setStep] = useState<ReviewWorkflowStep>(1)

  if (
    template.category !== requestCategoryValues.credential ||
    template.type !== type ||
    template.status !== entityStatuses.active
  ) {
    throw new TypeError(`Invalid credential lifecycle template: ${template.id}`)
  }

  const service = backoffice.services.find(
    (item) => item.id === apiKey.serviceId,
  )
  if (!service) throw new Error(`Credential service not found: ${apiKey.id}`)
  const serviceName = service.name
  const serviceOwnerOrganizationId = service.ownerOrganizationId
  const organizationOptions = backoffice.organizations.filter((organization) =>
    requester?.organizationIds.includes(organization.id),
  )
  const requestOrganization = organizationOptions.find(
    (organization) => organization.id === requestOrganizationId,
  )
  const approvalLineComplete = requestApprovalLineDraftIsComplete(
    approvalSteps,
    requester?.id,
  )

  function resetApprovalSteps(nextOrganizationId: string | null) {
    setApprovalSteps(
      createRequestApprovalLineDraft(backoffice, template, {
        requesterId: requester?.id,
        requestOrganizationId: nextOrganizationId,
        serviceOwnerOrganizationId,
      }),
    )
  }

  function fieldIsComplete(field: RequestTemplateField) {
    if (!field.required) return true
    switch (field.binding) {
      case requestTemplateFieldBindingValues.serviceId:
        return true
      case requestTemplateFieldBindingValues.keyName:
        return true
      case requestTemplateFieldBindingValues.awsSecretName:
        return awsSecretNameSchema.safeParse(awsSecretName).success
      case requestTemplateFieldBindingValues.awsSecretKey:
        return awsSecretKeySchema.safeParse(awsSecretKey).success
      case requestTemplateFieldBindingValues.requestOrganizationId:
        return Boolean(requestOrganizationId)
      case requestTemplateFieldBindingValues.content:
        return content.trim().length >= 10
      case requestTemplateFieldBindingValues.custom:
        return Boolean(customValues[field.id]?.trim())
    }
  }

  const fieldsComplete = template.fields.every(fieldIsComplete)

  function renderField(field: RequestTemplateField) {
    if (
      field.binding === requestTemplateFieldBindingValues.serviceId ||
      field.binding === requestTemplateFieldBindingValues.keyName
    ) {
      return null
    }
    if (field.binding === requestTemplateFieldBindingValues.awsSecretName) {
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
    if (field.binding === requestTemplateFieldBindingValues.awsSecretKey) {
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
    if (
      field.binding === requestTemplateFieldBindingValues.requestOrganizationId
    ) {
      return (
        <FormSelect
          key={field.id}
          label={field.label}
          value={requestOrganizationId}
          onValueChange={(value) => {
            setRequestOrganizationId(value)
            resetApprovalSteps(value)
          }}
          options={organizationOptions.map((organization) => ({
            value: organization.id,
            label: organization.name,
          }))}
        />
      )
    }
    if (field.binding === requestTemplateFieldBindingValues.content) {
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
        {field.control === requestTemplateFieldControlValues.textarea ? (
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

  function reviewFieldValue(field: RequestTemplateField) {
    switch (field.binding) {
      case requestTemplateFieldBindingValues.serviceId:
        return serviceName
      case requestTemplateFieldBindingValues.keyName:
        return apiKey.name
      case requestTemplateFieldBindingValues.awsSecretName:
        return awsSecretName
      case requestTemplateFieldBindingValues.awsSecretKey:
        return awsSecretKey
      case requestTemplateFieldBindingValues.requestOrganizationId:
        return requestOrganization?.name ?? "—"
      case requestTemplateFieldBindingValues.content:
        return content
      case requestTemplateFieldBindingValues.custom:
        return customValues[field.id] ?? ""
    }
  }

  async function submit() {
    const base = {
      title: t(
        type === approvalTypeValues.apiKeyReplace
          ? "replacementTitle"
          : "disposalTitle",
        { keyName: apiKey.name },
      ),
      organizationId: requestOrganizationId,
      requesterId: requester?.id,
      approvalLineId: template.id,
      apiKeyId: apiKey.id,
      content,
      fieldValues: template.fields
        .filter(
          (field) => field.binding === requestTemplateFieldBindingValues.custom,
        )
        .map((field) => ({
          fieldId: field.id,
          value: customValues[field.id] ?? "",
        })),
      approvalSteps: toRequestApprovalStepInputs(approvalSteps),
      submission: "submitted",
    }
    const parsed = approvalDocumentInputSchema.safeParse(
      type === approvalTypeValues.apiKeyReplace
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
    router.replace(`/approval-documents/requests/${result.value.id}`)
  }

  const isReplacement = type === approvalTypeValues.apiKeyReplace
  return (
    <RequestWorkflow
      title={t(
        isReplacement ? "replacementRequestTitle" : "disposalRequestTitle",
      )}
      description={t("lifecycleRequestDescription")}
      cancelLabel={common("cancel")}
      cancelHref={`/credentials/${apiKey.id}`}
      {...(step === 2 ? { previousLabel: common("previous") } : {})}
      submitLabel={step === 1 ? common("next") : t("lifecycleSubmit")}
      submitDisabled={
        !requester || !fieldsComplete || (step === 2 && !approvalLineComplete)
      }
      onPrevious={() => {
        setStep(1)
        setError(undefined)
      }}
      onSubmit={() => {
        setError(undefined)
        if (step === 1) {
          resetApprovalSteps(requestOrganizationId)
          setStep(2)
          return
        }
        void submit()
      }}
    >
      <ReviewWorkflowProgress step={step} label={t("requestProgress")} />
      {step === 1 ? (
        <div className="grid gap-6">
          <dl className="grid gap-3 rounded-lg border bg-surface-subtle p-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{t("keyName")}</dt>
              <dd className="mt-1 font-medium">{apiKey.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("service")}</dt>
              <dd className="mt-1 font-medium">{serviceName}</dd>
            </div>
          </dl>
          <div className="grid gap-4">{renderFields()}</div>
        </div>
      ) : (
        <section
          className="grid gap-5"
          aria-labelledby="lifecycle-review-title"
        >
          <div className="grid gap-1">
            <h3 id="lifecycle-review-title" className="text-base font-semibold">
              {t("lifecycleReviewTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("lifecycleReviewDescription")}
            </p>
          </div>
          <dl className="grid overflow-hidden rounded-card border sm:grid-cols-2">
            <div className="grid gap-1 border-b p-3 sm:border-r">
              <dt className="text-xs text-muted-foreground">{t("keyName")}</dt>
              <dd className="font-medium">{apiKey.name}</dd>
            </div>
            <div className="grid gap-1 border-b p-3">
              <dt className="text-xs text-muted-foreground">{t("service")}</dt>
              <dd className="font-medium">{serviceName}</dd>
            </div>
            <div className="grid gap-1 border-b p-3 sm:border-r">
              <dt className="text-xs text-muted-foreground">
                {documentsT("requester")}
              </dt>
              <dd className="font-medium">{requester?.nickname}</dd>
            </div>
            <div className="grid gap-1 border-b p-3">
              <dt className="text-xs text-muted-foreground">
                {documentsT("requestOrganization")}
              </dt>
              <dd className="font-medium">{requestOrganization?.name}</dd>
            </div>
            {template.fields
              .filter(
                (field) =>
                  field.binding !==
                    requestTemplateFieldBindingValues.serviceId &&
                  field.binding !== requestTemplateFieldBindingValues.keyName &&
                  field.binding !==
                    requestTemplateFieldBindingValues.requestOrganizationId,
              )
              .toSorted((left, right) => left.order - right.order)
              .map((field) => (
                <div
                  key={field.id}
                  className="grid gap-1 border-b p-3 sm:col-span-2"
                >
                  <dt className="text-xs text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="break-words whitespace-pre-wrap">
                    {reviewFieldValue(field)}
                  </dd>
                </div>
              ))}
          </dl>
          <RequestApprovalLineEditor
            steps={approvalSteps}
            onChange={setApprovalSteps}
            users={backoffice.users}
            organizations={backoffice.organizations}
            requesterId={requester?.id}
          />
        </section>
      )}
      <CommandErrorMessage error={error} />
    </RequestWorkflow>
  )
}
