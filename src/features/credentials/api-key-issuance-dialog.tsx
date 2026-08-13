"use client"

import { KeyRound } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, type ChangeEvent } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { RequestDialog } from "@/components/patterns/request-dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import { FormSelect } from "@/components/patterns/form-select"
import {
  awsSecretKeySchema,
  awsSecretNameSchema,
} from "@/features/credentials/model"
import type {
  ApprovalLine,
  ApprovalStep,
  RequestTemplateField,
} from "@/features/request-templates/model"
import { resolveRequestOrganizationLeader } from "@/features/request-templates/approval-assignee"
import type { BackofficeErrorCode } from "@/domain/common"
import {
  RequestMultiTargetSelector,
  RequestTargetSelector,
} from "@/features/credentials/request-target-selector"
import { approvalDocumentInputSchema } from "@/features/access-policies/model"
import { useBackoffice } from "@/application/state/provider"
import {
  CommandErrorMessage,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

export type ApiKeyIssuanceDialogProps = {
  templates: ApprovalLine[]
  initialServiceId?: string
  triggerLabel?: string
  excludedServiceIds?: readonly string[]
}

type IssuanceStep = 1 | 2 | 3

const issuanceSteps: IssuanceStep[] = [1, 2, 3]

export function ApiKeyIssuanceDialog({
  templates,
  initialServiceId,
  triggerLabel,
  excludedServiceIds = [],
}: ApiKeyIssuanceDialogProps) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const common = useTranslations("backoffice.common")
  const documentsT = useTranslations("backoffice.approvalDocuments")
  const t = useTranslations("backoffice.apiKeys")
  const labels = useBackofficeLabels()

  function credentialTemplateForService(candidateServiceId: string) {
    const service = backoffice.services.find(
      (item) => item.id === candidateServiceId,
    )
    if (!service) return undefined
    return templates.find(
      (template) =>
        template.id === service.credentialTemplateIds.issuance &&
        template.status === "active" &&
        template.category === "credential" &&
        template.type === "api-key",
    )
  }

  const requester = sessionAccess.currentUser
  const defaultRequestOrganizationId = requester?.organizationIds[0] ?? null
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<IssuanceStep>(1)
  const [keyName, setKeyName] = useState("")
  const [awsSecretName, setAwsSecretName] = useState("")
  const [awsSecretKey, setAwsSecretKey] = useState("")
  const [content, setContent] = useState("")
  const [serviceId, setServiceId] = useState<string | null>(
    initialServiceId ?? null,
  )
  const [endpointIds, setEndpointIds] = useState<string[]>([])
  const [requestOrganizationId, setRequestOrganizationId] = useState<
    string | null
  >(defaultRequestOrganizationId)
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [error, setError] = useState<BackofficeErrorCode>()

  const requestOrganization = backoffice.organizations.find(
    (item) => item.id === requestOrganizationId,
  )
  const requestOrganizationLeader = resolveRequestOrganizationLeader(
    backoffice,
    requestOrganizationId,
    requester?.id,
  )
  const selectedService = backoffice.services.find(
    (item) => item.id === serviceId,
  )
  const selectableEndpoints = backoffice.serviceEndpoints.filter(
    (endpoint) => endpoint.serviceId === serviceId,
  )
  const selectedEndpoints = selectableEndpoints.filter((endpoint) =>
    endpointIds.includes(endpoint.id),
  )
  const template = serviceId
    ? credentialTemplateForService(serviceId)
    : undefined
  const activeServices = backoffice.services.filter(
    (service) =>
      service.status === "active" &&
      !excludedServiceIds.includes(service.id) &&
      Boolean(credentialTemplateForService(service.id)),
  )
  if (
    initialServiceId &&
    !activeServices.some((service) => service.id === initialServiceId)
  ) {
    throw new Error(`Initial credential service not found: ${initialServiceId}`)
  }
  if (activeServices.length === 0) return null
  const assignmentCandidates = backoffice.users.filter(
    (user) =>
      user.employmentStatus === "employed" &&
      Boolean(
        requestOrganizationId &&
        user.organizationIds.includes(requestOrganizationId),
      ),
  )
  const assignmentsComplete = Boolean(
    template?.steps.every(
      (step) =>
        (step.assigneeMode !== "document-select" ||
          Boolean(assignments[step.id])) &&
        (step.assigneeMode !== "request-organization-leader" ||
          Boolean(requestOrganizationLeader)),
    ),
  )
  const targetComplete = Boolean(
    selectedService &&
    (selectedService.type === "external" || endpointIds.length > 0),
  )

  function resetTemplateValues() {
    setKeyName("")
    setAwsSecretName("")
    setAwsSecretKey("")
    setContent("")
    setRequestOrganizationId(defaultRequestOrganizationId)
    setCustomValues({})
    setAssignments({})
    setError(undefined)
  }

  function resetRequestValues() {
    setStep(1)
    setServiceId(initialServiceId ?? null)
    setEndpointIds([])
    resetTemplateValues()
  }

  function reset() {
    resetRequestValues()
  }

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
        return (
          backoffice.users.find((user) => user.id === assignments[step.id])
            ?.nickname ?? labels.assigneeMode(step.assigneeMode)
        )
      case "requester":
        return requester?.nickname
      case "request-organization-leader":
        return requestOrganizationLeader?.leader.nickname
      case "request-organization":
        return requestOrganization?.name
      case "service-owner-organization":
        return backoffice.organizations.find(
          (organization) =>
            organization.id === selectedService?.ownerOrganizationId,
        )?.name
    }
  }

  function fieldIsComplete(field: RequestTemplateField) {
    if (!field.required) return true
    switch (field.binding) {
      case "service-id":
        return Boolean(serviceId)
      case "request-organization-id":
        return Boolean(requestOrganizationId)
      case "key-name":
        return keyName.trim().length >= 2
      case "aws-secret-name":
        return awsSecretNameSchema.safeParse(awsSecretName).success
      case "aws-secret-key":
        return awsSecretKeySchema.safeParse(awsSecretKey).success
      case "content":
        return content.trim().length >= 10
      case "custom":
        return Boolean(customValues[field.id]?.trim())
    }
  }

  const fieldsComplete = Boolean(template?.fields.every(fieldIsComplete))

  function renderField(field: RequestTemplateField) {
    const id = `credential-field-${field.id}`
    switch (field.binding) {
      case "service-id":
        return null
      case "request-organization-id":
        return (
          <FormSelect
            key={field.id}
            label={field.label}
            value={requestOrganizationId}
            onValueChange={(value) => {
              setRequestOrganizationId(value)
              setAssignments({})
            }}
            options={backoffice.organizations
              .filter((organization) =>
                requester?.organizationIds.includes(organization.id),
              )
              .map((organization) => ({
                value: organization.id,
                label: organization.name,
              }))}
          />
        )
      case "key-name":
        return (
          <Field key={field.id}>
            <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
            <Input
              id={id}
              required={field.required}
              minLength={2}
              maxLength={80}
              value={keyName}
              onChange={(event) => {
                setKeyName(event.currentTarget.value)
              }}
            />
          </Field>
        )
      case "aws-secret-name":
        return (
          <Field key={field.id}>
            <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
            <Input
              id={id}
              required={field.required}
              pattern="[A-Za-z0-9/_+=.@-]+"
              maxLength={512}
              value={awsSecretName}
              onChange={(event) => {
                setAwsSecretName(event.currentTarget.value)
              }}
            />
          </Field>
        )
      case "aws-secret-key":
        return (
          <Field key={field.id}>
            <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
            <Input
              id={id}
              required={field.required}
              pattern="[A-Za-z0-9_.-]+"
              maxLength={128}
              value={awsSecretKey}
              onChange={(event) => {
                setAwsSecretKey(event.currentTarget.value)
              }}
            />
          </Field>
        )
      case "content":
        return (
          <Field key={field.id}>
            <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
            <Textarea
              id={id}
              required={field.required}
              minLength={10}
              maxLength={5000}
              value={content}
              onChange={(event) => {
                setContent(event.currentTarget.value)
              }}
            />
          </Field>
        )
      case "custom": {
        const value = customValues[field.id] ?? ""
        const sharedProps = {
          id,
          required: field.required,
          maxLength: 5000,
          value,
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
    }
  }

  function renderFields() {
    return template?.fields
      .filter((field) => field.binding !== "service-id")
      .toSorted((left, right) => left.order - right.order)
      .map(renderField)
  }

  function renderApprovalFlow(editable: boolean) {
    return (
      <section className="grid gap-2" aria-label={documentsT("preview")}>
        {template?.steps.map((approvalStep) => {
          const isParallel =
            template.steps.filter(
              (candidate) => candidate.stage === approvalStep.stage,
            ).length > 1
          return (
            <div
              key={approvalStep.id}
              className="grid gap-2 rounded-lg border p-3"
            >
              <div>
                <span className="mr-2 font-semibold">{approvalStep.order}</span>
                {labels.stepKind(approvalStep.kind)} ·{" "}
                {t("stage", { stage: approvalStep.stage })}
                {isParallel ? ` · ${t("parallel")}` : null}
              </div>
              {editable && approvalStep.assigneeMode === "document-select" ? (
                <FormSelect
                  label={documentsT("stepAssignee")}
                  value={assignments[approvalStep.id] ?? null}
                  onValueChange={(value) => {
                    setAssignments((current) => {
                      if (value) {
                        return { ...current, [approvalStep.id]: value }
                      }
                      return Object.fromEntries(
                        Object.entries(current).filter(
                          ([id]) => id !== approvalStep.id,
                        ),
                      )
                    })
                  }}
                  options={assignmentCandidates.map((user) => ({
                    value: user.id,
                    label: user.nickname,
                  }))}
                />
              ) : (
                <span className="text-sm text-muted-foreground">
                  {resolveStepLabel(approvalStep) ??
                    labels.assigneeMode(approvalStep.assigneeMode)}
                </span>
              )}
            </div>
          )
        })}
      </section>
    )
  }

  function reviewFieldValue(field: RequestTemplateField) {
    switch (field.binding) {
      case "service-id":
        return selectedService?.name ?? "—"
      case "request-organization-id":
        return requestOrganization?.name ?? "—"
      case "key-name":
        return keyName
      case "aws-secret-name":
        return awsSecretName
      case "aws-secret-key":
        return awsSecretKey
      case "content":
        return content
      case "custom":
        return customValues[field.id] ?? ""
    }
  }

  function renderTargetStep() {
    return (
      <section className="grid gap-5" aria-labelledby="credential-target-step">
        <div className="grid gap-1">
          <h3 id="credential-target-step" className="text-base font-semibold">
            {t("targetStepTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("targetStepDescription")}
          </p>
        </div>
        <div className="grid min-h-0 items-start gap-4 md:grid-cols-2">
          <RequestTargetSelector
            label={t("targetSelection")}
            description={t("targetSelectionDescription")}
            searchLabel={t("targetSearch")}
            empty={t("targetEmpty")}
            options={activeServices.map((service) => ({
              id: service.id,
              title: service.name,
              description: service.host,
              searchText: service.code,
            }))}
            value={serviceId}
            onValueChange={(value) => {
              setServiceId(value)
              setEndpointIds([])
              resetTemplateValues()
            }}
            listClassName="h-[min(38svh,20rem)] max-h-none"
          />
          {selectedService?.type === "internal" ? (
            <RequestMultiTargetSelector
              key={selectedService.id}
              label={t("endpointSelection")}
              description={t("endpointSelectionDescription")}
              searchLabel={t("endpointSearch")}
              empty={t("endpointEmpty")}
              selectedCountLabel={t("endpointSelectedCount", {
                count: endpointIds.length,
              })}
              options={selectableEndpoints.map((endpoint) => ({
                id: endpoint.id,
                title: `${endpoint.method} ${endpoint.path}`,
                description: endpoint.name,
                searchText: `${endpoint.method} ${endpoint.path} ${endpoint.name}`,
              }))}
              value={endpointIds}
              onValueChange={setEndpointIds}
              listClassName="h-[min(38svh,20rem)] max-h-none"
            />
          ) : selectedService ? (
            <p className="rounded-lg border border-info-foreground/20 bg-info p-3 text-sm text-info-foreground">
              {t("externalEndpointNotice")}
            </p>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t("selectServiceFirst")}
            </p>
          )}
        </div>
      </section>
    )
  }

  function renderInformationStep() {
    return (
      <section
        className="grid gap-5"
        aria-labelledby="credential-information-step"
      >
        <div className="grid gap-1">
          <h3
            id="credential-information-step"
            className="text-base font-semibold"
          >
            {t("informationStepTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("informationStepDescription")}
          </p>
        </div>
        <div className="grid gap-4">{renderFields()}</div>
      </section>
    )
  }

  function renderReviewStep() {
    return (
      <section className="grid gap-5" aria-labelledby="credential-review-step">
        <div className="grid gap-1">
          <h3 id="credential-review-step" className="text-base font-semibold">
            {t("reviewStepTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("reviewStepDescription")}
          </p>
        </div>
        <dl className="grid overflow-hidden rounded-card border sm:grid-cols-2">
          <div className="grid gap-1 border-b p-3 sm:border-r">
            <dt className="text-xs text-muted-foreground">{t("service")}</dt>
            <dd className="font-medium">{selectedService?.name}</dd>
          </div>
          <div className="grid gap-1 border-b p-3">
            <dt className="text-xs text-muted-foreground">
              {t("endpointSelection")}
            </dt>
            <dd className="font-medium">
              {selectedService?.type === "external"
                ? t("serviceLevelCredential")
                : t("endpointSelectedCount", {
                    count: selectedEndpoints.length,
                  })}
            </dd>
          </div>
          {template?.fields
            .filter((field) => field.binding !== "service-id")
            .toSorted((left, right) => left.order - right.order)
            .map((field) => (
              <div key={field.id} className="grid gap-1 border-b p-3">
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="min-w-0 break-words whitespace-pre-wrap">
                  {reviewFieldValue(field)}
                </dd>
              </div>
            ))}
          <div className="grid gap-1 p-3">
            <dt className="text-xs text-muted-foreground">
              {documentsT("requester")}
            </dt>
            <dd className="font-medium">{requester?.nickname}</dd>
          </div>
        </dl>
        {selectedEndpoints.length > 0 ? (
          <section className="grid gap-2" aria-label={t("selectedEndpoints")}>
            <h4 className="font-medium">{t("selectedEndpoints")}</h4>
            <ul className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
              {selectedEndpoints.map((endpoint) => (
                <li
                  key={endpoint.id}
                  className="grid gap-1 rounded-control border bg-surface-subtle p-3"
                >
                  <code className="text-xs font-medium">
                    {endpoint.method} {endpoint.path}
                  </code>
                  <span className="text-xs text-muted-foreground">
                    {endpoint.name}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {renderApprovalFlow(true)}
      </section>
    )
  }

  async function submit() {
    if (!template) {
      setError("approval-line-not-found")
      return
    }
    const parsed = approvalDocumentInputSchema.safeParse({
      documentKind: "api-key-issuance",
      title: t("documentTitle", { keyName }),
      type: "api-key",
      organizationId: requestOrganizationId,
      requesterId: requester?.id,
      approvalLineId: template.id,
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
      serviceId,
      endpointIds,
      keyName,
      awsSecretName,
      awsSecretKey,
    })
    if (!parsed.success) {
      setError("invalid-input")
      return
    }
    const result = await backoffice.createApprovalDocument(parsed.data)
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t("requested"))
    setOpen(false)
    reset()
  }

  return (
    <RequestDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) reset()
      }}
      triggerLabel={triggerLabel ?? t("request")}
      triggerIcon={KeyRound}
      title={t("requestTitle")}
      description={t("requestDescription")}
      cancelLabel={common("cancel")}
      {...(step > 1 ? { previousLabel: common("previous") } : {})}
      submitLabel={step < 3 ? common("next") : t("submit")}
      submitDisabled={
        !template ||
        !requester ||
        (step === 1
          ? !targetComplete
          : step === 2
            ? !targetComplete || !fieldsComplete
            : !targetComplete || !fieldsComplete || !assignmentsComplete)
      }
      onPrevious={() => {
        setError(undefined)
        setStep((current) => (current === 3 ? 2 : 1))
      }}
      onSubmit={() => {
        setError(undefined)
        if (step === 1) {
          setStep(2)
          return
        }
        if (step === 2) {
          setStep(3)
          return
        }
        void submit()
      }}
    >
      <div className="grid gap-2" aria-label={t("requestProgress")}>
        <ol className="grid grid-cols-3 gap-1 rounded-card bg-surface-subtle p-1.5">
          {issuanceSteps.map((item) => (
            <li
              key={item}
              aria-current={item === step ? "step" : undefined}
              className="flex min-w-0 items-center justify-center gap-2 rounded-control px-2 py-1.5 text-center"
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${
                  item <= step
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-text-subtle"
                }`}
              >
                {item}
              </span>
              <span className="hidden truncate text-xs font-medium sm:block">
                {t(`requestSteps.${String(item)}`)}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {step === 1
        ? renderTargetStep()
        : step === 2
          ? renderInformationStep()
          : renderReviewStep()}
      <CommandErrorMessage error={error} />
    </RequestDialog>
  )
}
