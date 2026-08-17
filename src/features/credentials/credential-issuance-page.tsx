"use client"

import { requestTemplateFieldControlValues } from "@/features/request-templates/model"
import { requestTemplateFieldBindingValues } from "@/features/request-templates/model"
import { requestCategoryValues } from "@/features/request-templates/model"
import { approvalTypeValues } from "@/features/request-templates/model"
import { approvalExecutionTypeValues } from "@/features/request-templates/model"
import { serviceTypeValues } from "@/features/service-catalog/model"
import { entityStatuses } from "@/domain/common"
import {
  approvalDocumentKinds,
  approvalDocumentSubmissions,
} from "@/features/access-policies/model"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState, type ChangeEvent } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { RequestWorkflow } from "@/components/patterns/request-workflow"
import {
  ReviewWorkflowProgress,
  type ReviewWorkflowStep,
} from "@/components/patterns/review-workflow-progress"
import { EmptyState } from "@/components/patterns/content-state"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import { FormSelect } from "@/components/patterns/form-select"
import {
  awsSecretKeyInputPattern,
  awsSecretKeySchema,
  awsSecretNameInputPattern,
  awsSecretNameSchema,
} from "@/features/credentials/model"
import type {
  ApprovalLine,
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
import {
  RequestMultiTargetSelector,
  RequestTargetSelector,
} from "@/features/credentials/request-target-selector"
import { approvalDocumentInputSchema } from "@/features/access-policies/model"
import { useBackoffice } from "@/application/state/provider"
import { CommandErrorMessage } from "@/application/ui/backoffice-ui"

export type CredentialIssuancePageProps = {
  templates?: ApprovalLine[]
  initialServiceId?: string
  excludedServiceIds?: readonly string[]
}

export function CredentialIssuancePage({
  templates,
  initialServiceId,
  excludedServiceIds,
}: CredentialIssuancePageProps) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const common = useTranslations("backoffice.common")
  const documentsT = useTranslations("backoffice.approvalDocuments")
  const t = useTranslations("backoffice.apiKeys")
  const availableTemplates = templates ?? backoffice.approvalLines

  function credentialTemplateForService(candidateServiceId: string) {
    const service = backoffice.services.find(
      (item) => item.id === candidateServiceId,
    )
    if (!service) return undefined
    return availableTemplates.find(
      (template) =>
        template.id === service.credentialTemplateIds.issuance &&
        template.status === entityStatuses.active &&
        template.category === requestCategoryValues.credential &&
        template.type === approvalTypeValues.apiKey,
    )
  }

  const requester = sessionAccess.currentUser
  const defaultRequestOrganizationId = requester?.organizationIds[0] ?? null
  const [step, setStep] = useState<ReviewWorkflowStep>(1)
  const [keyName, setKeyName] = useState("")
  const [awsSecretName, setAwsSecretName] = useState("")
  const [awsSecretKey, setAwsSecretKey] = useState("")
  const [content, setContent] = useState("")
  const [serviceId, setServiceId] = useState<string | null>(
    initialServiceId ?? null,
  )
  const [applicationId, setApplicationId] = useState<string | null>(null)
  const [endpointIds, setEndpointIds] = useState<string[]>([])
  const [requestOrganizationId, setRequestOrganizationId] = useState<
    string | null
  >(defaultRequestOrganizationId)
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [approvalSteps, setApprovalSteps] = useState<
    RequestApprovalStepDraft[]
  >([])
  const [error, setError] = useState<BackofficeErrorCode>()

  const requestOrganization = backoffice.organizations.find(
    (item) => item.id === requestOrganizationId,
  )
  const selectedApplication = backoffice.applications.find(
    (item) => item.id === applicationId,
  )
  const selectableApplications = backoffice.applications.filter((application) =>
    requester?.organizationIds.includes(application.ownerOrganizationId),
  )
  const effectiveExcludedServiceIds =
    excludedServiceIds ??
    backoffice.apiKeys
      .filter(
        (credential) =>
          credential.applicationId === applicationId &&
          credential.status === entityStatuses.active,
      )
      .map((credential) => credential.serviceId)
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
      service.status === entityStatuses.active &&
      !effectiveExcludedServiceIds.includes(service.id) &&
      Boolean(credentialTemplateForService(service.id)),
  )
  if (
    initialServiceId &&
    !activeServices.some((service) => service.id === initialServiceId)
  ) {
    return (
      <EmptyState
        title={t("requestTitle")}
        description={t("prerequisite")}
        action={
          <Button nativeButton={false} render={<Link href="/credentials" />}>
            {common("backToList")}
          </Button>
        }
      />
    )
  }
  if (activeServices.length === 0) {
    return (
      <EmptyState
        title={t("requestTitle")}
        description={t("prerequisite")}
        action={
          <Button nativeButton={false} render={<Link href="/credentials" />}>
            {common("backToList")}
          </Button>
        }
      />
    )
  }
  const approvalLineComplete =
    template?.approvalExecution.type === approvalExecutionTypeValues.groo ||
    requestApprovalLineDraftIsComplete(approvalSteps, requester?.id)
  const targetComplete = Boolean(
    selectedApplication &&
    selectedService &&
    (selectedService.type === serviceTypeValues.external ||
      endpointIds.length > 0),
  )

  function resetTemplateValues() {
    setKeyName("")
    setAwsSecretName("")
    setAwsSecretKey("")
    setContent("")
    setRequestOrganizationId(defaultRequestOrganizationId)
    setCustomValues({})
    setApprovalSteps([])
    setError(undefined)
  }

  function resetApprovalSteps(
    nextTemplate: ApprovalLine | undefined,
    nextOrganizationId: string | null,
    serviceOwnerOrganizationId: string | null | undefined,
  ) {
    setApprovalSteps(
      nextTemplate?.approvalExecution.type ===
        approvalExecutionTypeValues.internal
        ? createRequestApprovalLineDraft(backoffice, nextTemplate, {
            requesterId: requester?.id,
            requestOrganizationId: nextOrganizationId,
            serviceOwnerOrganizationId,
          })
        : [],
    )
  }

  function fieldIsComplete(field: RequestTemplateField) {
    if (!field.required) return true
    switch (field.binding) {
      case requestTemplateFieldBindingValues.serviceId:
        return Boolean(serviceId)
      case requestTemplateFieldBindingValues.requestOrganizationId:
        return Boolean(requestOrganizationId)
      case requestTemplateFieldBindingValues.keyName:
        return keyName.trim().length >= 2
      case requestTemplateFieldBindingValues.awsSecretName:
        return awsSecretNameSchema.safeParse(awsSecretName).success
      case requestTemplateFieldBindingValues.awsSecretKey:
        return awsSecretKeySchema.safeParse(awsSecretKey).success
      case requestTemplateFieldBindingValues.content:
        return content.trim().length >= 10
      case requestTemplateFieldBindingValues.custom:
        return Boolean(customValues[field.id]?.trim())
    }
  }

  const fieldsComplete = Boolean(template?.fields.every(fieldIsComplete))
  const inputComplete = targetComplete && fieldsComplete

  function renderField(field: RequestTemplateField) {
    const id = `credential-field-${field.id}`
    switch (field.binding) {
      case requestTemplateFieldBindingValues.serviceId:
        return null
      case requestTemplateFieldBindingValues.requestOrganizationId:
        return (
          <FormSelect
            key={field.id}
            label={field.label}
            value={requestOrganizationId}
            onValueChange={(value) => {
              setRequestOrganizationId(value)
              resetApprovalSteps(
                template,
                value,
                selectedService?.ownerOrganizationId,
              )
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
      case requestTemplateFieldBindingValues.keyName:
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
      case requestTemplateFieldBindingValues.awsSecretName:
        return (
          <Field key={field.id}>
            <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
            <Input
              id={id}
              required={field.required}
              pattern={awsSecretNameInputPattern}
              maxLength={512}
              value={awsSecretName}
              onChange={(event) => {
                setAwsSecretName(event.currentTarget.value)
              }}
            />
          </Field>
        )
      case requestTemplateFieldBindingValues.awsSecretKey:
        return (
          <Field key={field.id}>
            <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
            <Input
              id={id}
              required={field.required}
              pattern={awsSecretKeyInputPattern}
              maxLength={128}
              value={awsSecretKey}
              onChange={(event) => {
                setAwsSecretKey(event.currentTarget.value)
              }}
            />
          </Field>
        )
      case requestTemplateFieldBindingValues.content:
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
      case requestTemplateFieldBindingValues.custom: {
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
            {field.control === requestTemplateFieldControlValues.textarea ? (
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
      .filter(
        (field) =>
          field.binding !== requestTemplateFieldBindingValues.serviceId,
      )
      .toSorted((left, right) => left.order - right.order)
      .map(renderField)
  }

  function reviewFieldValue(field: RequestTemplateField) {
    switch (field.binding) {
      case requestTemplateFieldBindingValues.serviceId:
        return selectedService?.name ?? "—"
      case requestTemplateFieldBindingValues.requestOrganizationId:
        return requestOrganization?.name ?? "—"
      case requestTemplateFieldBindingValues.keyName:
        return keyName
      case requestTemplateFieldBindingValues.awsSecretName:
        return awsSecretName
      case requestTemplateFieldBindingValues.awsSecretKey:
        return awsSecretKey
      case requestTemplateFieldBindingValues.content:
        return content
      case requestTemplateFieldBindingValues.custom:
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
        <RequestTargetSelector
          label={t("applicationSelection")}
          description={t("applicationSelectionDescription")}
          searchLabel={t("applicationSearch")}
          empty={t("applicationEmpty")}
          options={selectableApplications.map((application) => ({
            id: application.id,
            title: application.name,
            description:
              backoffice.organizations.find(
                (organization) =>
                  organization.id === application.ownerOrganizationId,
              )?.name ?? "",
            searchText: application.slug,
          }))}
          value={applicationId}
          onValueChange={(value) => {
            const application = backoffice.applications.find(
              (candidate) => candidate.id === value,
            )
            setApplicationId(value)
            setRequestOrganizationId(application?.ownerOrganizationId ?? null)
            resetApprovalSteps(
              template,
              application?.ownerOrganizationId ?? null,
              selectedService?.ownerOrganizationId,
            )
          }}
          listClassName="h-48 max-h-none"
        />
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
              searchText: service.slug,
            }))}
            value={serviceId}
            onValueChange={(value) => {
              setServiceId(value)
              setEndpointIds([])
              resetTemplateValues()
            }}
            listClassName="h-[min(38svh,20rem)] max-h-none"
          />
          <RequestMultiTargetSelector
            key={selectedService?.id ?? "unselected-service"}
            label={t("endpointSelection")}
            description={t("endpointSelectionDescription")}
            searchLabel={t("endpointSearch")}
            empty={
              selectedService?.type === serviceTypeValues.external
                ? t("externalEndpointNotice")
                : selectedService
                  ? t("endpointEmpty")
                  : t("selectServiceFirst")
            }
            selectedCountLabel={t("endpointSelectedCount", {
              count: endpointIds.length,
            })}
            options={
              selectedService?.type === serviceTypeValues.internal
                ? selectableEndpoints.map((endpoint) => ({
                    id: endpoint.id,
                    title: `${endpoint.method} ${endpoint.path}`,
                    description: endpoint.name,
                    searchText: `${endpoint.method} ${endpoint.path} ${endpoint.name}`,
                  }))
                : []
            }
            value={endpointIds}
            onValueChange={setEndpointIds}
            disabled={selectedService?.type !== serviceTypeValues.internal}
            listClassName="h-[min(38svh,20rem)] max-h-none"
          />
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
            <dt className="text-xs text-muted-foreground">
              {t("application")}
            </dt>
            <dd className="font-medium">{selectedApplication?.name}</dd>
          </div>
          <div className="grid gap-1 border-b p-3">
            <dt className="text-xs text-muted-foreground">{t("service")}</dt>
            <dd className="font-medium">{selectedService?.name}</dd>
          </div>
          <div className="grid gap-1 border-b p-3 sm:border-r">
            <dt className="text-xs text-muted-foreground">
              {t("endpointSelection")}
            </dt>
            <dd className="font-medium">
              {selectedService?.type === serviceTypeValues.external
                ? t("serviceLevelCredential")
                : t("endpointSelectedCount", {
                    count: selectedEndpoints.length,
                  })}
            </dd>
          </div>
          {template?.fields
            .filter(
              (field) =>
                field.binding !== requestTemplateFieldBindingValues.serviceId,
            )
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
        {template?.approvalExecution.type ===
        approvalExecutionTypeValues.groo ? (
          <section
            className="grid gap-1 rounded-card border border-info-foreground/20 bg-info p-3 text-info-foreground"
            aria-labelledby="groo-approval-summary"
          >
            <h4 id="groo-approval-summary" className="font-medium">
              {t("grooApprovalTitle")}
            </h4>
            <p className="text-sm">{t("grooApprovalDescription")}</p>
          </section>
        ) : (
          <RequestApprovalLineEditor
            steps={approvalSteps}
            onChange={setApprovalSteps}
            users={backoffice.users}
            organizations={backoffice.organizations}
            requesterId={requester?.id}
          />
        )}
      </section>
    )
  }

  async function submit() {
    if (!template) {
      setError("approval-line-not-found")
      return
    }
    const parsed = approvalDocumentInputSchema.safeParse({
      documentKind: approvalDocumentKinds.apiKeyIssuance,
      title: t("documentTitle", { keyName }),
      type: approvalTypeValues.apiKey,
      organizationId: requestOrganizationId,
      requesterId: requester?.id,
      approvalLineId: template.id,
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
      submission: approvalDocumentSubmissions.submitted,
      applicationId,
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
    router.replace(`/approval-documents/requests/${result.value.id}`)
  }

  return (
    <RequestWorkflow
      title={t("requestTitle")}
      description={t("requestDescription")}
      cancelLabel={common("cancel")}
      cancelHref={
        initialServiceId ? `/services/${initialServiceId}` : "/credentials"
      }
      {...(step === 2 ? { previousLabel: common("previous") } : {})}
      submitLabel={step === 1 ? common("next") : t("submit")}
      submitDisabled={
        !template ||
        !requester ||
        !inputComplete ||
        (step === 2 && !approvalLineComplete)
      }
      onPrevious={() => {
        setError(undefined)
        setStep(1)
      }}
      onSubmit={() => {
        setError(undefined)
        if (step === 1) {
          resetApprovalSteps(
            template,
            requestOrganizationId,
            selectedService?.ownerOrganizationId,
          )
          setStep(2)
          return
        }
        void submit()
      }}
    >
      <ReviewWorkflowProgress step={step} label={t("requestProgress")} />
      {step === 1 ? (
        <div className="grid gap-6">
          {renderTargetStep()}
          <div className="border-t border-border-subtle pt-6">
            {renderInformationStep()}
          </div>
        </div>
      ) : (
        renderReviewStep()
      )}
      <CommandErrorMessage error={error} />
    </RequestWorkflow>
  )
}
