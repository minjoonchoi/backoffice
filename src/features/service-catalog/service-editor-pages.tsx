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
import { FormSelect } from "@/components/patterns/form-select"
import { RequestWorkflow } from "@/components/patterns/request-workflow"
import {
  ReviewWorkflowProgress,
  type ReviewWorkflowStep,
} from "@/components/patterns/review-workflow-progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import { entityStatuses, type BackofficeErrorCode } from "@/domain/common"
import {
  requestCategoryValues,
  approvalTypeValues,
} from "@/features/request-templates/model"
import {
  parseEndpointFields,
  toEndpointFieldInput,
} from "@/features/service-catalog/editor-support"
import {
  resolveEndpointChangeImpact,
  type EndpointChangeImpact,
} from "@/features/service-catalog/endpoint-impact"
import {
  endpointFieldLocationValues,
  endpointLifecycleValues,
  endpointVersionInputPattern,
  httpMethods,
  isEndpointRequestParameterLocation,
  serviceEndpointInputSchema,
  serviceInputSchema,
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
  const [slug, setSlug] = useState(service?.slug ?? "")
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

  const parsed = serviceInputSchema.safeParse({
    name,
    slug,
    host,
    type,
    ownerOrganizationId,
    credentialTemplateIds,
  })
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
      slug,
      host,
      type,
      ownerOrganizationId,
      credentialTemplateIds,
    })
    if (!nextInput.success) {
      setError("invalid-input")
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
      title={t(service ? "edit" : "add")}
      description={t(service ? "editDescription" : "addDescription")}
      cancelLabel={common("cancel")}
      cancelHref={service ? `/services/${service.id}` : "/services"}
      previousLabel={step === 2 ? common("previous") : undefined}
      submitLabel={
        step === 1 ? common("next") : common(service ? "save" : "create")
      }
      submitDisabled={!parsed.success}
      onPrevious={() => {
        setStep(1)
      }}
      onSubmit={() => void submit()}
    >
      <ReviewWorkflowProgress step={step} label={common("editorProgress")} />
      {step === 1 ? (
        <div className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="service-editor-name">
              {common("name")}
            </FieldLabel>
            <Input
              id="service-editor-name"
              value={name}
              required
              minLength={2}
              maxLength={100}
              onChange={(event) => {
                setName(event.currentTarget.value)
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="service-editor-slug">{t("slug")}</FieldLabel>
            <Input
              id="service-editor-slug"
              value={slug}
              required
              minLength={2}
              maxLength={32}
              pattern="[a-z]+(?:-[a-z]+)*"
              readOnly={Boolean(service)}
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) => {
                setSlug(event.currentTarget.value)
              }}
            />
            <FieldDescription>{t("slugDescription")}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="service-editor-host">{t("host")}</FieldLabel>
            <Input
              id="service-editor-host"
              type="url"
              value={host}
              required
              maxLength={2048}
              onChange={(event) => {
                setHost(event.currentTarget.value)
              }}
            />
          </Field>
          <FormSelect
            label={t("type")}
            value={type}
            onValueChange={setType}
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
              options={organizations.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
          ) : (
            <DetailItem label={t("owner")}>{owner?.name ?? "—"}</DetailItem>
          )}
          {service
            ? credentialTemplateFields.map(([key, requestType, label]) => (
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
                  options={credentialTemplates
                    .filter((template) => template.type === requestType)
                    .map((template) => ({
                      value: template.id,
                      label: template.name,
                    }))}
                />
              ))
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
            <DetailItem label={t("slug")}>
              <code>{slug.trim()}</code>
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
  const selectedService = services.find((service) => service.id === serviceId)
  const impact: EndpointChangeImpact | null =
    endpoint && parsed.success
      ? resolveEndpointChangeImpact(backoffice, endpoint.id, parsed.data.fields)
      : null

  async function submit() {
    if (!parsed.success) {
      setError("invalid-input")
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
      submitDisabled={!parsed.success}
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
            options={services.map((service) => ({
              value: service.id,
              label: service.name,
            }))}
          />
          <Field>
            <FieldLabel htmlFor="endpoint-editor-name">
              {common("name")}
            </FieldLabel>
            <Input
              id="endpoint-editor-name"
              value={name}
              required
              minLength={2}
              maxLength={100}
              onChange={(event) => {
                setName(event.currentTarget.value)
              }}
            />
          </Field>
          <FormSelect
            label={t("method")}
            value={method}
            onValueChange={setMethod}
            options={httpMethods.map((item) => ({ value: item, label: item }))}
          />
          <Field>
            <FieldLabel htmlFor="endpoint-editor-path">{t("path")}</FieldLabel>
            <Input
              id="endpoint-editor-path"
              value={path}
              required
              maxLength={500}
              pattern="/.*"
              onChange={(event) => {
                setPath(event.currentTarget.value)
              }}
            />
          </Field>
          <Field>
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
              onChange={(event) => {
                setVersion(event.currentTarget.value)
              }}
            />
          </Field>
          {(
            [
              [
                "request-parameters",
                "requestParameters",
                requestParameters,
                setRequestParameters,
              ],
              [
                "request-body",
                "requestBodyFields",
                requestBodyFields,
                setRequestBodyFields,
              ],
              [
                "response-body",
                "responseBodyFields",
                responseBodyFields,
                setResponseBodyFields,
              ],
            ] as const
          ).map(([id, label, value, setValue]) => (
            <Field key={id}>
              <FieldLabel htmlFor={`endpoint-editor-${id}`}>
                {t(label)}
              </FieldLabel>
              <Textarea
                id={`endpoint-editor-${id}`}
                value={value}
                required
                rows={8}
                className="max-h-64 font-mono text-xs"
                onChange={(event) => {
                  setValue(event.currentTarget.value)
                }}
              />
            </Field>
          ))}
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
          {impact ? (
            <section className="grid gap-2 rounded-card border border-warning-foreground/30 bg-warning p-3">
              <h3 className="font-semibold">{t("changeImpactTitle")}</h3>
              <p className="text-sm text-warning-foreground">
                {t("changeImpactDescription")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">
                  {t("addedFieldCount", { count: impact.addedFields.length })}
                </Badge>
                <Badge variant="destructive">
                  {t("removedFieldCount", {
                    count: impact.removedFields.length,
                  })}
                </Badge>
                <Badge variant="warning">
                  {t("changedFieldCount", {
                    count: impact.changedFields.length,
                  })}
                </Badge>
                <Badge variant="outline">
                  {t("affectedPolicyCount", {
                    count: impact.accessPolicyIds.length,
                  })}
                </Badge>
                <Badge variant="outline">
                  {t("affectedCredentialCount", {
                    count: impact.apiKeyIds.length,
                  })}
                </Badge>
              </div>
            </section>
          ) : null}
          <CommandErrorMessage error={error} />
        </section>
      )}
    </RequestWorkflow>
  )
}
