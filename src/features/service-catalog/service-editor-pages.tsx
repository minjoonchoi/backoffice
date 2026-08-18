"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { useBackoffice } from "@/application/state/provider"
import {
  CommandErrorMessage,
  ServiceTypeBadge,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"
import { useSessionAccess } from "@/auth/session-access-provider"
import { canManageService } from "@/auth/service-resource-access"
import { EmptyState } from "@/components/patterns/content-state"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import {
  FieldValidationMessage,
  useDynamicFormValidation,
} from "@/components/patterns/dynamic-form-validation"
import { FormSelect } from "@/components/patterns/form-select"
import { RequestWorkflow } from "@/components/patterns/request-workflow"
import {
  ReviewWorkflowProgress,
  type ReviewWorkflowStep,
} from "@/components/patterns/review-workflow-progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import { entityStatuses, type BackofficeErrorCode } from "@/domain/common"
import {
  requestCategoryValues,
  approvalTypeValues,
} from "@/features/request-templates/model"
import {
  parseEndpointFieldSection,
  parseEndpointFields,
  toEndpointFieldInput,
} from "@/features/service-catalog/editor-support"
import {
  resolveEndpointChangeImpact,
  type EndpointChangeImpact,
} from "@/features/service-catalog/endpoint-impact"
import { EndpointChangeImpactPanel } from "@/features/service-catalog/endpoint-impact-view"
import {
  endpointFieldLocationValues,
  endpointLifecycleValues,
  endpointVersionInputPattern,
  filterServiceKeyInput,
  httpMethods,
  isEndpointRequestParameterLocation,
  serviceEndpointInputSchema,
  serviceEndpointFieldInputSchema,
  serviceInputSchema,
  serviceKeyInputPattern,
  serviceTypes,
  serviceTypeValues,
  type HttpMethod,
  type ServiceType,
} from "@/features/service-catalog/model"
import { useServiceResourceAccess } from "@/features/service-catalog/use-service-resource-access"

const credentialTemplateFields = [
  ["issuance", approvalTypeValues.apiKey, "credentialIssuanceTemplate"],
  [
    "replacement",
    approvalTypeValues.apiKeyReplace,
    "credentialReplacementTemplate",
  ],
  ["disposal", approvalTypeValues.apiKeyDispose, "credentialDisposalTemplate"],
] as const

export function ServiceEditorPage({ serviceId }: { serviceId?: string }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const access = useServiceResourceAccess()
  const router = useRouter()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.services")
  const labels = useBackofficeLabels()
  const service = serviceId
    ? backoffice.services.find((item) => item.id === serviceId)
    : undefined
  const credentialTemplates = backoffice.approvalLines.filter(
    (template) =>
      template.category === requestCategoryValues.credential &&
      (template.status === entityStatuses.active ||
        Object.values(service?.credentialTemplateIds ?? {}).includes(
          template.id,
        )),
  )
  const firstTemplateId = (
    type: (typeof approvalTypeValues)[keyof typeof approvalTypeValues],
  ) => credentialTemplates.find((template) => template.type === type)?.id ?? ""
  const organizations = backoffice.organizations.filter((organization) =>
    access.manageableOrganizationIds.includes(organization.id),
  )
  const defaultOwnerOrganizationId =
    service?.ownerOrganizationId ?? organizations[0]?.id ?? ""
  const [step, setStep] = useState<ReviewWorkflowStep>(1)
  const [name, setName] = useState(service?.name ?? "")
  const [serviceKey, setServiceKey] = useState(service?.serviceKey ?? "")
  const [host, setHost] = useState(service?.host ?? "")
  const [type, setType] = useState<ServiceType | null>(service?.type ?? null)
  const [ownerOrganizationId, setOwnerOrganizationId] = useState<string | null>(
    defaultOwnerOrganizationId || null,
  )
  const [credentialTemplateIds, setCredentialTemplateIds] = useState({
    issuance:
      service?.credentialTemplateIds.issuance ??
      firstTemplateId(approvalTypeValues.apiKey),
    replacement:
      service?.credentialTemplateIds.replacement ??
      firstTemplateId(approvalTypeValues.apiKeyReplace),
    disposal:
      service?.credentialTemplateIds.disposal ??
      firstTemplateId(approvalTypeValues.apiKeyDispose),
  })
  const [error, setError] = useState<BackofficeErrorCode>()
  const parsed = serviceInputSchema.safeParse({
    name,
    serviceKey,
    host,
    type,
    ownerOrganizationId,
    credentialTemplateIds,
  })
  const validation = useDynamicFormValidation(
    parsed.success ? undefined : parsed.error,
  )
  const nameValidation = validation.getFieldValidation(
    "name",
    "service-editor-name-error",
  )
  const serviceKeyValidation = validation.getFieldValidation(
    "serviceKey",
    "service-editor-service-key-error",
  )
  const hostValidation = validation.getFieldValidation(
    "host",
    "service-editor-host-error",
  )
  const typeValidation = validation.getFieldValidation(
    "type",
    "service-editor-type-error",
  )
  const ownerValidation = validation.getFieldValidation(
    "ownerOrganizationId",
    "service-editor-owner-error",
  )

  if (serviceId && !service) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          <Button nativeButton={false} render={<Link href="/services" />}>
            {common("backToList")}
          </Button>
        }
      />
    )
  }
  if (organizations.length === 0) {
    return (
      <EmptyState
        title={t(service ? "edit" : "add")}
        description={t("prerequisite")}
      />
    )
  }

  const owner = organizations.find((item) => item.id === ownerOrganizationId)
  const hasEndpoints = Boolean(
    service &&
    backoffice.serviceEndpoints.some(
      (endpoint) => endpoint.serviceId === service.id,
    ),
  )

  async function submit() {
    const nextInput = serviceInputSchema.safeParse({
      name,
      serviceKey,
      host,
      type,
      ownerOrganizationId,
      credentialTemplateIds,
    })
    if (!nextInput.success) {
      validation.revealAll()
      setStep(1)
      return
    }
    if (step === 1) {
      setError(undefined)
      setStep(2)
      return
    }
    const requesterId = sessionAccess.currentUser?.id ?? ""
    const result = service
      ? await backoffice.updateService(service.id, nextInput.data, requesterId)
      : await backoffice.createService(nextInput.data, requesterId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t(service ? "updated" : "created"))
    router.replace(`/services/${result.value.id}`)
  }

  return (
    <RequestWorkflow
      noValidate
      title={t(service ? "edit" : "add")}
      description={t(service ? "editDescription" : "addDescription")}
      cancelLabel={common("cancel")}
      cancelHref={service ? `/services/${service.id}` : "/services"}
      previousLabel={step === 2 ? common("previous") : undefined}
      submitLabel={
        step === 1 ? common("next") : common(service ? "save" : "create")
      }
      onPrevious={() => {
        setStep(1)
      }}
      onSubmit={() => void submit()}
    >
      <ReviewWorkflowProgress step={step} label={common("editorProgress")} />
      {step === 1 ? (
        <div className="grid gap-4">
          <Field invalid={nameValidation.invalid}>
            <FieldLabel htmlFor="service-editor-name">
              {common("name")}
            </FieldLabel>
            <Input
              id="service-editor-name"
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
          <Field invalid={serviceKeyValidation.invalid}>
            <FieldLabel htmlFor="service-editor-service-key">
              {t("serviceKey")}
            </FieldLabel>
            <Input
              id="service-editor-service-key"
              value={serviceKey}
              required
              minLength={2}
              maxLength={32}
              pattern={serviceKeyInputPattern}
              readOnly={Boolean(service)}
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={serviceKeyValidation.invalid}
              aria-describedby={serviceKeyValidation.errorId}
              onChange={(event) => {
                validation.touch("serviceKey")
                setServiceKey(filterServiceKeyInput(event.currentTarget.value))
              }}
            />
            <FieldDescription>{t("serviceKeyDescription")}</FieldDescription>
            <FieldValidationMessage validation={serviceKeyValidation} />
          </Field>
          <Field invalid={hostValidation.invalid}>
            <FieldLabel htmlFor="service-editor-host">{t("host")}</FieldLabel>
            <Input
              id="service-editor-host"
              type="url"
              value={host}
              required
              maxLength={2048}
              aria-invalid={hostValidation.invalid}
              aria-describedby={hostValidation.errorId}
              onChange={(event) => {
                validation.touch("host")
                setHost(event.currentTarget.value)
              }}
            />
            <FieldValidationMessage validation={hostValidation} />
          </Field>
          <FormSelect
            label={t("type")}
            value={type}
            onValueChange={setType}
            error={typeValidation.error}
            onInteract={() => {
              validation.touch("type")
            }}
            options={serviceTypes
              .filter(
                (item) => item === serviceTypeValues.internal || !hasEndpoints,
              )
              .map((item) => ({
                value: item,
                label: labels.serviceType(item),
              }))}
          />
          {access.isAdministrator || service ? (
            <FormSelect
              label={t("owner")}
              value={ownerOrganizationId}
              onValueChange={setOwnerOrganizationId}
              error={ownerValidation.error}
              onInteract={() => {
                validation.touch("ownerOrganizationId")
              }}
              options={organizations.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
          ) : (
            <DetailItem label={t("owner")}>{owner?.name ?? "—"}</DetailItem>
          )}
          {service
            ? credentialTemplateFields.map(([key, requestType, label]) => {
                const fieldName = `credentialTemplateIds.${key}`
                const templateValidation = validation.getFieldValidation(
                  fieldName,
                  `service-editor-${key}-template-error`,
                )
                return (
                  <FormSelect
                    key={key}
                    label={t(label)}
                    value={credentialTemplateIds[key] || null}
                    onValueChange={(value) => {
                      setCredentialTemplateIds((current) => ({
                        ...current,
                        [key]: value,
                      }))
                    }}
                    error={templateValidation.error}
                    onInteract={() => {
                      validation.touch(fieldName)
                    }}
                    options={credentialTemplates
                      .filter((template) => template.type === requestType)
                      .map((template) => ({
                        value: template.id,
                        label: template.name,
                      }))}
                  />
                )
              })
            : null}
          <CommandErrorMessage error={error} />
        </div>
      ) : (
        <section className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="text-base font-semibold">{common("reviewTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {common("reviewDescription")}
            </p>
          </div>
          <DetailGrid>
            <DetailItem label={common("name")}>{name.trim()}</DetailItem>
            <DetailItem label={t("serviceKey")}>
              <code>{serviceKey.trim()}</code>
            </DetailItem>
            <DetailItem label={t("host")}>{host.trim()}</DetailItem>
            <DetailItem label={t("type")}>
              {type ? <ServiceTypeBadge type={type} /> : "—"}
            </DetailItem>
            <DetailItem label={t("owner")}>{owner?.name ?? "—"}</DetailItem>
            {service
              ? credentialTemplateFields.map(([key, , label]) => (
                  <DetailItem key={key} label={t(label)}>
                    {credentialTemplates.find(
                      (template) => template.id === credentialTemplateIds[key],
                    )?.name ?? "—"}
                  </DetailItem>
                ))
              : null}
          </DetailGrid>
          <CommandErrorMessage error={error} />
        </section>
      )}
    </RequestWorkflow>
  )
}

export function ServiceEndpointEditorPage({
  endpointId,
}: {
  endpointId?: string
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const access = useServiceResourceAccess()
  const router = useRouter()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.endpoints")
  const validationMessages = useTranslations("backoffice.validation")
  const endpoint = endpointId
    ? backoffice.serviceEndpoints.find((item) => item.id === endpointId)
    : undefined
  const endpointFields = endpoint
    ? backoffice.serviceEndpointFields.filter(
        (field) => field.endpointId === endpoint.id,
      )
    : []
  const stringifyFields = (fields: typeof endpointFields) =>
    JSON.stringify(fields.map(toEndpointFieldInput), null, 2)
  const services = backoffice.services.filter(
    (service) =>
      service.status === entityStatuses.active &&
      service.type === serviceTypeValues.internal &&
      canManageService(access, service),
  )
  const [step, setStep] = useState<ReviewWorkflowStep>(1)
  const [serviceId, setServiceId] = useState<string | null>(
    endpoint?.serviceId ?? services[0]?.id ?? null,
  )
  const [name, setName] = useState(endpoint?.name ?? "")
  const [method, setMethod] = useState<HttpMethod | null>(
    endpoint?.method ?? null,
  )
  const [path, setPath] = useState(endpoint?.path ?? "")
  const [version, setVersion] = useState(endpoint?.version ?? "v1")
  const [requestParameters, setRequestParameters] = useState(
    stringifyFields(
      endpointFields.filter((field) =>
        isEndpointRequestParameterLocation(field.location),
      ),
    ),
  )
  const [requestBodyFields, setRequestBodyFields] = useState(
    stringifyFields(
      endpointFields.filter(
        (field) => field.location === endpointFieldLocationValues.requestBody,
      ),
    ),
  )
  const [responseBodyFields, setResponseBodyFields] = useState(
    stringifyFields(
      endpointFields.filter(
        (field) => field.location === endpointFieldLocationValues.responseBody,
      ),
    ),
  )
  const [error, setError] = useState<BackofficeErrorCode>()
  const parsed = serviceEndpointInputSchema.safeParse({
    serviceId,
    name,
    method,
    path,
    version,
    lifecycle: endpoint?.lifecycle ?? endpointLifecycleValues.active,
    fields: parseEndpointFields(
      requestParameters,
      requestBodyFields,
      responseBodyFields,
    ),
  })
  const validation = useDynamicFormValidation(
    parsed.success ? undefined : parsed.error,
  )
  const serviceValidation = validation.getFieldValidation(
    "serviceId",
    "endpoint-editor-service-error",
  )
  const nameValidation = validation.getFieldValidation(
    "name",
    "endpoint-editor-name-error",
  )
  const methodValidation = validation.getFieldValidation(
    "method",
    "endpoint-editor-method-error",
  )
  const pathValidation = validation.getFieldValidation(
    "path",
    "endpoint-editor-path-error",
  )
  const versionValidation = validation.getFieldValidation(
    "version",
    "endpoint-editor-version-error",
  )
  const endpointFieldSections = [
    {
      id: "request-parameters",
      label: "requestParameters" as const,
      name: "requestParameters",
      value: requestParameters,
      setValue: setRequestParameters,
      parsed: parseEndpointFieldSection(requestParameters),
    },
    {
      id: "request-body",
      label: "requestBodyFields" as const,
      name: "requestBodyFields",
      value: requestBodyFields,
      setValue: setRequestBodyFields,
      parsed: parseEndpointFieldSection(
        requestBodyFields,
        endpointFieldLocationValues.requestBody,
      ),
    },
    {
      id: "response-body",
      label: "responseBodyFields" as const,
      name: "responseBodyFields",
      value: responseBodyFields,
      setValue: setResponseBodyFields,
      parsed: parseEndpointFieldSection(
        responseBodyFields,
        endpointFieldLocationValues.responseBody,
      ),
    },
  ] as const

  if (endpointId && !endpoint) {
    return <EmptyState title={t("detailTitle")} description={t("notFound")} />
  }
  if (services.length === 0) {
    return (
      <EmptyState
        title={t(endpoint ? "edit" : "add")}
        description={t("prerequisite")}
      />
    )
  }
  const selectedService = services.find((service) => service.id === serviceId)
  const impact: EndpointChangeImpact | null =
    endpoint && parsed.success
      ? resolveEndpointChangeImpact(backoffice, endpoint.id, parsed.data.fields)
      : null

  async function submit() {
    if (!parsed.success) {
      validation.revealAll()
      setStep(1)
      return
    }
    if (step === 1) {
      setError(undefined)
      setStep(2)
      return
    }
    const requesterId = sessionAccess.currentUser?.id ?? ""
    const result = endpoint
      ? await backoffice.updateServiceEndpoint(
          endpoint.id,
          parsed.data,
          requesterId,
        )
      : await backoffice.createServiceEndpoint(parsed.data, requesterId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t(endpoint ? "updated" : "created"))
    router.replace(`/service-endpoints/${result.value.id}`)
  }

  return (
    <RequestWorkflow
      noValidate
      title={t(endpoint ? "edit" : "add")}
      description={t(endpoint ? "editDescription" : "addDescription")}
      cancelLabel={common("cancel")}
      cancelHref={
        endpoint ? `/service-endpoints/${endpoint.id}` : "/service-endpoints"
      }
      previousLabel={step === 2 ? common("previous") : undefined}
      submitLabel={
        step === 1 ? common("next") : common(endpoint ? "save" : "create")
      }
      onPrevious={() => {
        setStep(1)
      }}
      onSubmit={() => void submit()}
    >
      <ReviewWorkflowProgress step={step} label={common("editorProgress")} />
      {step === 1 ? (
        <div className="grid gap-4">
          <FormSelect
            label={t("service")}
            value={serviceId}
            onValueChange={setServiceId}
            error={serviceValidation.error}
            onInteract={() => {
              validation.touch("serviceId")
            }}
            options={services.map((service) => ({
              value: service.id,
              label: service.name,
            }))}
          />
          <Field invalid={nameValidation.invalid}>
            <FieldLabel htmlFor="endpoint-editor-name">
              {common("name")}
            </FieldLabel>
            <Input
              id="endpoint-editor-name"
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
            label={t("method")}
            value={method}
            onValueChange={setMethod}
            error={methodValidation.error}
            onInteract={() => {
              validation.touch("method")
            }}
            options={httpMethods.map((item) => ({ value: item, label: item }))}
          />
          <Field invalid={pathValidation.invalid}>
            <FieldLabel htmlFor="endpoint-editor-path">{t("path")}</FieldLabel>
            <Input
              id="endpoint-editor-path"
              value={path}
              required
              maxLength={500}
              pattern="/.*"
              aria-invalid={pathValidation.invalid}
              aria-describedby={pathValidation.errorId}
              onChange={(event) => {
                validation.touch("path")
                setPath(event.currentTarget.value)
              }}
            />
            <FieldValidationMessage validation={pathValidation} />
          </Field>
          <Field invalid={versionValidation.invalid}>
            <FieldLabel htmlFor="endpoint-editor-version">
              {t("version")}
            </FieldLabel>
            <Input
              id="endpoint-editor-version"
              value={version}
              required
              minLength={1}
              maxLength={40}
              pattern={endpointVersionInputPattern}
              aria-invalid={versionValidation.invalid}
              aria-describedby={versionValidation.errorId}
              onChange={(event) => {
                validation.touch("version")
                setVersion(event.currentTarget.value)
              }}
            />
            <FieldValidationMessage validation={versionValidation} />
          </Field>
          {endpointFieldSections.map((section) => {
            const fieldError =
              validation.shouldShowError(section.name) &&
              !serviceEndpointFieldInputSchema.array().safeParse(section.parsed)
                .success
                ? validationMessages("invalid")
                : undefined
            const errorId = fieldError
              ? `endpoint-editor-${section.id}-error`
              : undefined
            return (
              <Field key={section.id} invalid={Boolean(fieldError)}>
                <FieldLabel htmlFor={`endpoint-editor-${section.id}`}>
                  {t(section.label)}
                </FieldLabel>
                <Textarea
                  id={`endpoint-editor-${section.id}`}
                  value={section.value}
                  required
                  rows={8}
                  className="max-h-64 font-mono text-xs"
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby={errorId}
                  onChange={(event) => {
                    validation.touch(section.name)
                    section.setValue(event.currentTarget.value)
                  }}
                />
                {fieldError ? (
                  <FieldError id={errorId}>{fieldError}</FieldError>
                ) : null}
              </Field>
            )
          })}
          <FieldDescription>{t("schemaInputDescription")}</FieldDescription>
          <CommandErrorMessage error={error} />
        </div>
      ) : (
        <section className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="text-base font-semibold">{common("reviewTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {common("reviewDescription")}
            </p>
          </div>
          <DetailGrid>
            <DetailItem label={t("service")}>
              {selectedService?.name ?? "—"}
            </DetailItem>
            <DetailItem label={common("name")}>{name.trim()}</DetailItem>
            <DetailItem label={t("method")}>
              <Badge variant="outline">{method}</Badge>
            </DetailItem>
            <DetailItem label={t("path")}>
              <code>{path.trim()}</code>
            </DetailItem>
            <DetailItem label={t("version")}>{version.trim()}</DetailItem>
            <DetailItem label={t("fieldTotal")}>
              {parsed.success ? parsed.data.fields.length : 0}
            </DetailItem>
          </DetailGrid>
          {impact ? <EndpointChangeImpactPanel impact={impact} /> : null}
          <CommandErrorMessage error={error} />
        </section>
      )}
    </RequestWorkflow>
  )
}
