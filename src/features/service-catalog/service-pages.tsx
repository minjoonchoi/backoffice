"use client"

import { uiResourceKeys } from "@/config/menu-registry"
import type { ColumnDef } from "@tanstack/react-table"
import { Cloud, Network, Pencil, Plus, Server, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { UiResourceLink } from "@/auth/ui-resource-link"
import {
  canManageService,
  resolveServiceResourceAccess,
} from "@/auth/service-resource-access"
import { ConfirmAction } from "@/components/patterns/confirm-action"
import { EmptyState } from "@/components/patterns/content-state"
import {
  DataTable,
  type DataTableFilter,
} from "@/components/patterns/data-table"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import {
  FormDialog,
  FormDialogContent,
} from "@/components/patterns/form-dialog"
import { MetricCard } from "@/components/patterns/metric-card"
import { PageHeader } from "@/components/patterns/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import {
  httpMethods,
  serviceTypes,
  type HttpMethod,
  type ManagedService,
  type ServiceEndpoint,
  type ServiceEndpointField,
  type ServiceEndpointFieldInput,
  type ServiceType,
} from "@/features/service-catalog/model"
import type { BackofficeErrorCode } from "@/domain/common"
import { FormSelect } from "@/components/patterns/form-select"
import { ApiKeyIssuanceDialog } from "@/features/credentials/api-key-issuance-dialog"
import {
  serviceEndpointInputSchema,
  serviceInputSchema,
} from "@/features/service-catalog/model"
import { useBackoffice } from "@/application/state/provider"
import {
  ServiceTypeBadge,
  StatusBadge,
  CommandErrorMessage,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

function useServiceResourceAccess() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  return resolveServiceResourceAccess(
    backoffice,
    sessionAccess.currentUser?.id ?? null,
  )
}

function parseJsonArrayFormField(
  value: FormDataEntryValue | null,
): unknown[] | null {
  if (typeof value !== "string") return null
  const source = value.trim()
  if (!source) return []
  try {
    const parsed: unknown = JSON.parse(source)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function setEndpointFieldLocation(
  field: unknown,
  location: "request-body" | "response-body",
): unknown {
  if (typeof field !== "object" || field === null || Array.isArray(field)) {
    return field
  }
  return { ...field, location }
}

function parseEndpointFields(data: FormData): unknown {
  const parameters = parseJsonArrayFormField(data.get("requestParameters"))
  const requestBody = parseJsonArrayFormField(data.get("requestBodyFields"))
  const responseBody = parseJsonArrayFormField(data.get("responseBodyFields"))
  if (!parameters || !requestBody || !responseBody) return null
  return [
    ...parameters,
    ...requestBody.map((field) =>
      setEndpointFieldLocation(field, "request-body"),
    ),
    ...responseBody.map((field) =>
      setEndpointFieldLocation(field, "response-body"),
    ),
  ]
}

function toEndpointFieldInput(
  field: ServiceEndpointField,
): ServiceEndpointFieldInput {
  return {
    location: field.location,
    fieldPath: field.fieldPath,
    valueType: field.valueType,
    required: field.required,
    description: field.description,
  }
}

function EndpointFieldsTable({
  fields,
  caption,
  empty,
}: {
  fields: ServiceEndpointField[]
  caption: string
  empty: string
}) {
  const t = useTranslations("backoffice.endpoints")
  const columns = useMemo<ColumnDef<ServiceEndpointField>[]>(
    () => [
      {
        accessorKey: "fieldPath",
        header: t("fieldPath"),
        size: 180,
        cell: ({ row }) => (
          <code className="font-semibold">{row.original.fieldPath}</code>
        ),
      },
      {
        accessorKey: "location",
        header: t("location"),
        size: 130,
        cell: ({ row }) => (
          <Badge variant="outline">
            {t(`locations.${row.original.location}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "valueType",
        header: t("valueType"),
        size: 100,
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.valueType}</Badge>
        ),
      },
      {
        accessorKey: "required",
        header: t("required"),
        size: 90,
        cell: ({ row }) => (
          <Badge variant={row.original.required ? "info" : "outline"}>
            {row.original.required
              ? t("requiredParameter")
              : t("optionalParameter")}
          </Badge>
        ),
      },
      {
        accessorKey: "description",
        header: t("fieldDescription"),
        size: 240,
      },
      {
        accessorKey: "id",
        header: t("fieldId"),
        size: 310,
        cell: ({ row }) => (
          <code className="text-xs text-muted-foreground">
            {row.original.id}
          </code>
        ),
      },
    ],
    [t],
  )

  return (
    <DataTable
      caption={caption}
      columns={columns}
      data={fields}
      empty={empty}
      getRowId={(field) => field.id}
    />
  )
}

function ServiceEditDialog({ service }: { service: ManagedService }) {
  const backoffice = useBackoffice()
  const access = useServiceResourceAccess()
  const t = useTranslations("backoffice.services")
  const common = useTranslations("backoffice.common")
  const labels = useBackofficeLabels()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<ServiceType | null>(service.type)
  const [organizationId, setOrganizationId] = useState<string | null>(
    service.ownerOrganizationId,
  )
  const [credentialTemplateIds, setCredentialTemplateIds] = useState(
    service.credentialTemplateIds,
  )
  const [error, setError] = useState<BackofficeErrorCode>()
  const hasEndpoints = backoffice.serviceEndpoints.some(
    (endpoint) => endpoint.serviceId === service.id,
  )
  const organizations = backoffice.organizations.filter((organization) =>
    access.manageableOrganizationIds.includes(organization.id),
  )
  const formId = `service-${service.id}-form`

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    setType(service.type)
    setOrganizationId(service.ownerOrganizationId)
    setCredentialTemplateIds(service.credentialTemplateIds)
    setError(undefined)
  }

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const parsed = serviceInputSchema.safeParse({
      name: data.get("name"),
      code: data.get("code"),
      host: data.get("host"),
      type,
      ownerOrganizationId: organizationId,
      credentialTemplateIds,
    })
    if (!parsed.success) {
      setError("invalid-input")
      return
    }
    const result = await backoffice.updateService(service.id, parsed.data)
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t("updated"))
    setOpen(false)
  }

  return (
    <FormDialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Pencil />
        {t("edit")}
      </DialogTrigger>
      <FormDialogContent>
        <DialogHeader>
          <DialogTitle>{t("edit")}</DialogTitle>
          <DialogDescription>{t("editDescription")}</DialogDescription>
        </DialogHeader>
        <form
          id={formId}
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(event.currentTarget)
          }}
        >
          <Field>
            <FieldLabel htmlFor={`${formId}-name`}>{common("name")}</FieldLabel>
            <Input
              id={`${formId}-name`}
              name="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={service.name}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-code`}>{common("code")}</FieldLabel>
            <Input
              id={`${formId}-code`}
              aria-describedby={`${formId}-code-description`}
              name="code"
              required
              minLength={2}
              maxLength={32}
              pattern="[a-z]+(?:-[a-z]+)*"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={service.code}
            />
            <FieldDescription id={`${formId}-code-description`}>
              {t("codeDescription")}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-host`}>{t("host")}</FieldLabel>
            <Input
              id={`${formId}-host`}
              name="host"
              type="url"
              required
              maxLength={2048}
              defaultValue={service.host}
            />
          </Field>
          <FormSelect
            label={t("type")}
            value={type}
            onValueChange={setType}
            options={serviceTypes
              .filter((item) => item === "internal" || !hasEndpoints)
              .map((item) => ({
                value: item,
                label: labels.serviceType(item),
              }))}
          />
          <FormSelect
            label={t("owner")}
            value={organizationId}
            onValueChange={setOrganizationId}
            options={organizations.map((organization) => ({
              value: organization.id,
              label: organization.name,
            }))}
          />
          {(
            [
              ["issuance", "api-key", "credentialIssuanceTemplate"],
              [
                "replacement",
                "api-key-replace",
                "credentialReplacementTemplate",
              ],
              ["disposal", "api-key-dispose", "credentialDisposalTemplate"],
            ] as const
          ).map(([key, requestType, label]) => (
            <FormSelect
              key={key}
              label={t(label)}
              value={credentialTemplateIds[key]}
              onValueChange={(value) => {
                setCredentialTemplateIds((current) => ({
                  ...current,
                  [key]: value,
                }))
              }}
              options={backoffice.approvalLines
                .filter(
                  (template) =>
                    (template.status === "active" ||
                      template.id === service.credentialTemplateIds[key]) &&
                    template.category === "credential" &&
                    template.type === requestType,
                )
                .map((template) => ({
                  value: template.id,
                  label: template.name,
                }))}
            />
          ))}
          <CommandErrorMessage error={error} />
        </form>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {common("cancel")}
          </DialogClose>
          <Button
            type="submit"
            form={formId}
            disabled={!type || !organizationId}
          >
            {common("save")}
          </Button>
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}

function ServicesTable({
  data,
  canViewDetail,
}: {
  data: ManagedService[]
  canViewDetail: boolean
}) {
  const backoffice = useBackoffice()
  const t = useTranslations("backoffice.services")
  const common = useTranslations("backoffice.common")
  const columns = useMemo<ColumnDef<ManagedService>[]>(
    () => [
      {
        accessorKey: "name",
        header: common("name"),
      },
      { accessorKey: "code", header: common("code") },
      {
        accessorKey: "host",
        header: t("host"),
        cell: ({ row }) => (
          <span className="break-all">{row.original.host}</span>
        ),
        size: 260,
      },
      {
        accessorKey: "type",
        header: t("type"),
        cell: ({ row }) => <ServiceTypeBadge type={row.original.type} />,
      },
      {
        id: "owner",
        header: t("owner"),
        cell: ({ row }) => {
          const organization = backoffice.organizations.find(
            (item) => item.id === row.original.ownerOrganizationId,
          )
          if (!organization) {
            throw new Error(
              `Service owner organization not found: ${row.original.ownerOrganizationId}`,
            )
          }
          return (
            <UiResourceLink
              resourceKey={uiResourceKeys.organizations.detail.key}
              href={`/organizations/${organization.id}`}
              className="text-primary hover:underline"
            >
              {organization.name}
            </UiResourceLink>
          )
        },
      },
      {
        id: "status",
        header: common("status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [common, t, backoffice],
  )
  return (
    <DataTable
      caption={t("tableCaption")}
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      getRowHref={(row) => (canViewDetail ? `/services/${row.id}` : undefined)}
      getRowLabel={(row) => `${row.name} ${common("details")}`}
      empty={t("empty")}
      filterLabel={common("search")}
      noResults={common("noResults")}
      filters={[
        {
          id: "service-name",
          label: common("name"),
          getValue: (row) => row.name,
        },
        {
          id: "service-code",
          label: common("code"),
          getValue: (row) => row.code,
        },
        { id: "service-host", label: t("host"), getValue: (row) => row.host },
        {
          id: "service-type",
          label: t("type"),
          getValue: (row) => t(`types.${row.type}`),
        },
        {
          id: "service-owner",
          label: t("owner"),
          getValue: (row) =>
            backoffice.organizations.find(
              (item) => item.id === row.ownerOrganizationId,
            )?.name ?? "",
        },
      ]}
    />
  )
}

function ServiceCreationDialog() {
  const backoffice = useBackoffice()
  const access = useServiceResourceAccess()
  const t = useTranslations("backoffice.services")
  const common = useTranslations("backoffice.common")
  const labels = useBackofficeLabels()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<ServiceType | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const credentialTemplates = backoffice.approvalLines.filter(
    (template) =>
      template.category === "credential" && template.status === "active",
  )
  function firstCredentialTemplateId(
    requestType: "api-key" | "api-key-replace" | "api-key-dispose",
  ) {
    return (
      credentialTemplates.find((template) => template.type === requestType)
        ?.id ?? null
    )
  }
  const [credentialTemplateIds, setCredentialTemplateIds] = useState({
    issuance: firstCredentialTemplateId("api-key"),
    replacement: firstCredentialTemplateId("api-key-replace"),
    disposal: firstCredentialTemplateId("api-key-dispose"),
  })
  const [error, setError] = useState<BackofficeErrorCode>()
  const organizations = backoffice.organizations.filter((organization) =>
    access.manageableOrganizationIds.includes(organization.id),
  )
  const formId = "service-create-form"

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    setType(null)
    setOrganizationId(null)
    setCredentialTemplateIds({
      issuance: firstCredentialTemplateId("api-key"),
      replacement: firstCredentialTemplateId("api-key-replace"),
      disposal: firstCredentialTemplateId("api-key-dispose"),
    })
    setError(undefined)
  }

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const parsed = serviceInputSchema.safeParse({
      name: data.get("name"),
      code: data.get("code"),
      host: data.get("host"),
      type,
      ownerOrganizationId: organizationId,
      credentialTemplateIds,
    })
    if (!parsed.success) {
      setError("invalid-input")
      return
    }
    const result = await backoffice.createService(parsed.data)
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t("created"))
    setOpen(false)
  }

  return (
    <FormDialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        {t("add")}
      </DialogTrigger>
      <FormDialogContent>
        <DialogHeader>
          <DialogTitle>{t("add")}</DialogTitle>
          <DialogDescription>{t("addDescription")}</DialogDescription>
        </DialogHeader>
        {organizations.length === 0 ? (
          <EmptyState title={t("add")} description={t("prerequisite")} />
        ) : (
          <form
            id={formId}
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void submit(event.currentTarget)
            }}
          >
            <Field>
              <FieldLabel htmlFor="service-name">{common("name")}</FieldLabel>
              <Input
                id="service-name"
                name="name"
                required
                minLength={2}
                maxLength={100}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="service-code">{common("code")}</FieldLabel>
              <Input
                id="service-code"
                aria-describedby="service-code-description"
                name="code"
                required
                minLength={2}
                pattern="[a-z]+(?:-[a-z]+)*"
                maxLength={32}
                autoCapitalize="none"
                spellCheck={false}
              />
              <FieldDescription id="service-code-description">
                {t("codeDescription")}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="service-host">{t("host")}</FieldLabel>
              <Input
                id="service-host"
                name="host"
                type="url"
                required
                maxLength={2048}
              />
            </Field>
            <FormSelect
              label={t("type")}
              value={type}
              onValueChange={setType}
              options={serviceTypes.map((item) => ({
                value: item,
                label: labels.serviceType(item),
              }))}
            />
            <FormSelect
              label={t("owner")}
              value={organizationId}
              onValueChange={setOrganizationId}
              options={organizations.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
            {(
              [
                ["issuance", "api-key", "credentialIssuanceTemplate"],
                [
                  "replacement",
                  "api-key-replace",
                  "credentialReplacementTemplate",
                ],
                ["disposal", "api-key-dispose", "credentialDisposalTemplate"],
              ] as const
            ).map(([key, requestType, label]) => (
              <FormSelect
                key={key}
                label={t(label)}
                value={credentialTemplateIds[key]}
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
            ))}
            <CommandErrorMessage error={error} />
          </form>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {common("cancel")}
          </DialogClose>
          {organizations.length ? (
            <Button
              type="submit"
              form={formId}
              disabled={
                !type ||
                !organizationId ||
                !credentialTemplateIds.issuance ||
                !credentialTemplateIds.replacement ||
                !credentialTemplateIds.disposal
              }
            >
              {common("create")}
            </Button>
          ) : null}
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}

export function ServicesPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const access = useServiceResourceAccess()
  const t = useTranslations("backoffice.services")
  const common = useTranslations("backoffice.common")
  const canRegister =
    sessionAccess.canAccessUiResource(
      uiResourceKeys.services.list.actions.createService,
    ) &&
    (access.isAdministrator || access.manageableOrganizationIds.length > 0)
  const canViewDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.services.detail.key,
  )
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={canRegister ? <ServiceCreationDialog /> : null}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={Cloud}
          title={t("total")}
          value={backoffice.services.length}
        />
        <MetricCard
          icon={Server}
          title={t("internalCount")}
          value={
            backoffice.services.filter((item) => item.type === "internal")
              .length
          }
        />
        <MetricCard
          icon={Cloud}
          title={t("externalCount")}
          value={
            backoffice.services.filter((item) => item.type === "external")
              .length
          }
        />
      </div>
      <ServicesTable data={backoffice.services} canViewDetail={canViewDetail} />
      <p className="text-xs text-muted-foreground">{common("sessionNotice")}</p>
    </div>
  )
}

function EndpointEditDialog({ endpoint }: { endpoint: ServiceEndpoint }) {
  const backoffice = useBackoffice()
  const access = useServiceResourceAccess()
  const t = useTranslations("backoffice.endpoints")
  const common = useTranslations("backoffice.common")
  const [open, setOpen] = useState(false)
  const [serviceId, setServiceId] = useState<string | null>(endpoint.serviceId)
  const [method, setMethod] = useState<HttpMethod | null>(endpoint.method)
  const [error, setError] = useState<BackofficeErrorCode>()
  const services = backoffice.services.filter(
    (service) =>
      service.status === "active" &&
      service.type === "internal" &&
      canManageService(access, service),
  )
  const formId = `endpoint-${endpoint.id}-form`
  const endpointFields = backoffice.serviceEndpointFields.filter(
    (field) => field.endpointId === endpoint.id,
  )
  const requestParameters = endpointFields.filter((field) =>
    ["path", "query", "header"].includes(field.location),
  )
  const requestBodyFields = endpointFields.filter(
    (field) => field.location === "request-body",
  )
  const responseBodyFields = endpointFields.filter(
    (field) => field.location === "response-body",
  )

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    setServiceId(endpoint.serviceId)
    setMethod(endpoint.method)
    setError(undefined)
  }

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const parsed = serviceEndpointInputSchema.safeParse({
      serviceId,
      name: data.get("name"),
      method,
      path: data.get("path"),
      fields: parseEndpointFields(data),
    })
    if (!parsed.success) {
      setError("invalid-input")
      return
    }
    const result = await backoffice.updateServiceEndpoint(
      endpoint.id,
      parsed.data,
    )
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t("updated"))
    setOpen(false)
  }

  return (
    <FormDialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Pencil />
        {t("edit")}
      </DialogTrigger>
      <FormDialogContent>
        <DialogHeader>
          <DialogTitle>{t("edit")}</DialogTitle>
          <DialogDescription>{t("editDescription")}</DialogDescription>
        </DialogHeader>
        <form
          id={formId}
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(event.currentTarget)
          }}
        >
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
            <FieldLabel htmlFor={`${formId}-name`}>{common("name")}</FieldLabel>
            <Input
              id={`${formId}-name`}
              name="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={endpoint.name}
            />
          </Field>
          <FormSelect
            label={t("method")}
            value={method}
            onValueChange={setMethod}
            options={httpMethods.map((item) => ({
              value: item,
              label: item,
            }))}
          />
          <Field>
            <FieldLabel htmlFor={`${formId}-path`}>{t("path")}</FieldLabel>
            <Input
              id={`${formId}-path`}
              name="path"
              required
              maxLength={500}
              pattern="/.*"
              defaultValue={endpoint.path}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-request-parameters`}>
              {t("requestParameters")}
            </FieldLabel>
            <Textarea
              id={`${formId}-request-parameters`}
              name="requestParameters"
              required
              rows={8}
              className="font-mono text-xs"
              defaultValue={JSON.stringify(
                requestParameters.map(toEndpointFieldInput),
                null,
                2,
              )}
              aria-describedby={`${formId}-schema-description`}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-request-body-fields`}>
              {t("requestBodyFields")}
            </FieldLabel>
            <Textarea
              id={`${formId}-request-body-fields`}
              name="requestBodyFields"
              required
              rows={8}
              className="font-mono text-xs"
              defaultValue={JSON.stringify(
                requestBodyFields.map(toEndpointFieldInput),
                null,
                2,
              )}
              aria-describedby={`${formId}-schema-description`}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-response-body-fields`}>
              {t("responseBodyFields")}
            </FieldLabel>
            <Textarea
              id={`${formId}-response-body-fields`}
              name="responseBodyFields"
              required
              rows={8}
              className="font-mono text-xs"
              defaultValue={JSON.stringify(
                responseBodyFields.map(toEndpointFieldInput),
                null,
                2,
              )}
              aria-describedby={`${formId}-schema-description`}
            />
          </Field>
          <FieldDescription id={`${formId}-schema-description`}>
            {t("schemaInputDescription")}
          </FieldDescription>
          <CommandErrorMessage error={error} />
        </form>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {common("cancel")}
          </DialogClose>
          <Button type="submit" form={formId} disabled={!serviceId || !method}>
            {common("save")}
          </Button>
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}

function EndpointsTable({
  data,
  showService = true,
  canViewDetail,
}: {
  data: ServiceEndpoint[]
  showService?: boolean
  canViewDetail: boolean
}) {
  const backoffice = useBackoffice()
  const t = useTranslations("backoffice.endpoints")
  const common = useTranslations("backoffice.common")
  const columns = useMemo<ColumnDef<ServiceEndpoint>[]>(() => {
    const nextColumns: ColumnDef<ServiceEndpoint>[] = [
      {
        accessorKey: "name",
        header: common("name"),
      },
      { accessorKey: "method", header: t("method"), size: 80 },
      {
        accessorKey: "path",
        header: t("path"),
        cell: ({ row }) => {
          const service = backoffice.services.find(
            (item) => item.id === row.original.serviceId,
          )
          if (!service) {
            throw new Error(`Endpoint service not found: ${row.original.id}`)
          }
          return (
            <a
              href={new URL(row.original.path, service.host).toString()}
              target="_blank"
              rel="noreferrer"
              className="break-all text-primary hover:underline"
            >
              {row.original.path}
            </a>
          )
        },
        size: 320,
      },
    ]
    if (showService) {
      nextColumns.splice(1, 0, {
        id: "service",
        header: t("service"),
        cell: ({ row }) => {
          const service = backoffice.services.find(
            (item) => item.id === row.original.serviceId,
          )
          if (!service) {
            throw new Error(`Endpoint service not found: ${row.original.id}`)
          }
          return (
            <UiResourceLink
              resourceKey={uiResourceKeys.services.detail.key}
              href={`/services/${service.id}`}
              className="text-primary hover:underline"
            >
              {service.name}
            </UiResourceLink>
          )
        },
      })
    }
    return nextColumns
  }, [common, showService, t, backoffice.services])
  const filters = useMemo<DataTableFilter<ServiceEndpoint>[]>(() => {
    const nextFilters: DataTableFilter<ServiceEndpoint>[] = [
      {
        id: "endpoint-name",
        label: common("name"),
        getValue: (row) => row.name,
      },
      {
        id: "endpoint-method",
        label: t("method"),
        getValue: (row) => row.method,
      },
      { id: "endpoint-path", label: t("path"), getValue: (row) => row.path },
    ]
    if (showService) {
      nextFilters.splice(1, 0, {
        id: "endpoint-service",
        label: t("service"),
        getValue: (row) =>
          backoffice.services.find((item) => item.id === row.serviceId)?.name ??
          "",
      })
    }
    return nextFilters
  }, [common, showService, t, backoffice.services])
  return (
    <DataTable
      caption={t("tableCaption")}
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      getRowHref={(row) =>
        canViewDetail ? `/service-endpoints/${row.id}` : undefined
      }
      getRowLabel={(row) => `${row.name} ${common("details")}`}
      empty={t("empty")}
      filterLabel={common("search")}
      noResults={common("noResults")}
      filters={filters}
    />
  )
}

function EndpointCreationDialog() {
  const backoffice = useBackoffice()
  const access = useServiceResourceAccess()
  const t = useTranslations("backoffice.endpoints")
  const common = useTranslations("backoffice.common")
  const [open, setOpen] = useState(false)
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [method, setMethod] = useState<HttpMethod | null>(null)
  const [error, setError] = useState<BackofficeErrorCode>()
  const services = backoffice.services.filter(
    (item) =>
      item.status === "active" &&
      item.type === "internal" &&
      canManageService(access, item),
  )
  const formId = "endpoint-create-form"

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    setServiceId(null)
    setMethod(null)
    setError(undefined)
  }

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const parsed = serviceEndpointInputSchema.safeParse({
      serviceId,
      name: data.get("name"),
      method,
      path: data.get("path"),
      fields: parseEndpointFields(data),
    })
    if (!parsed.success) {
      setError("invalid-input")
      return
    }
    const result = await backoffice.createServiceEndpoint(parsed.data)
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t("created"))
    setOpen(false)
  }

  return (
    <FormDialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        {t("add")}
      </DialogTrigger>
      <FormDialogContent>
        <DialogHeader>
          <DialogTitle>{t("add")}</DialogTitle>
          <DialogDescription>{t("addDescription")}</DialogDescription>
        </DialogHeader>
        {services.length === 0 ? (
          <EmptyState title={t("add")} description={t("prerequisite")} />
        ) : (
          <form
            id={formId}
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void submit(event.currentTarget)
            }}
          >
            <FormSelect
              label={t("service")}
              value={serviceId}
              onValueChange={setServiceId}
              options={services.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
            <Field>
              <FieldLabel htmlFor="endpoint-name">{common("name")}</FieldLabel>
              <Input
                id="endpoint-name"
                name="name"
                required
                minLength={2}
                maxLength={100}
              />
            </Field>
            <FormSelect
              label={t("method")}
              value={method}
              onValueChange={setMethod}
              options={httpMethods.map((item) => ({
                value: item,
                label: item,
              }))}
            />
            <Field>
              <FieldLabel htmlFor="endpoint-path">{t("path")}</FieldLabel>
              <Input
                id="endpoint-path"
                name="path"
                required
                pattern="/.*"
                maxLength={500}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="endpoint-request-parameters">
                {t("requestParameters")}
              </FieldLabel>
              <Textarea
                id="endpoint-request-parameters"
                name="requestParameters"
                required
                rows={8}
                className="font-mono text-xs"
                defaultValue="[]"
                aria-describedby="endpoint-schema-description"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="endpoint-request-body-fields">
                {t("requestBodyFields")}
              </FieldLabel>
              <Textarea
                id="endpoint-request-body-fields"
                name="requestBodyFields"
                required
                rows={8}
                className="font-mono text-xs"
                defaultValue="[]"
                aria-describedby="endpoint-schema-description"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="endpoint-response-body-fields">
                {t("responseBodyFields")}
              </FieldLabel>
              <Textarea
                id="endpoint-response-body-fields"
                name="responseBodyFields"
                required
                rows={8}
                className="font-mono text-xs"
                defaultValue="[]"
                aria-describedby="endpoint-schema-description"
              />
            </Field>
            <FieldDescription id="endpoint-schema-description">
              {t("schemaInputDescription")}
            </FieldDescription>
            <CommandErrorMessage error={error} />
          </form>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {common("cancel")}
          </DialogClose>
          {services.length ? (
            <Button
              type="submit"
              form={formId}
              disabled={!serviceId || !method}
            >
              {common("create")}
            </Button>
          ) : null}
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}

export function ServiceEndpointsPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const access = useServiceResourceAccess()
  const t = useTranslations("backoffice.endpoints")
  const common = useTranslations("backoffice.common")
  const canRegister =
    sessionAccess.canAccessUiResource(
      uiResourceKeys.serviceEndpoints.list.actions.createEndpoint,
    ) &&
    backoffice.services.some(
      (service) =>
        service.status === "active" &&
        service.type === "internal" &&
        canManageService(access, service),
    )
  const canViewDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.serviceEndpoints.detail.key,
  )
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={canRegister ? <EndpointCreationDialog /> : null}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          icon={Network}
          title={t("total")}
          value={backoffice.serviceEndpoints.length}
        />
        <MetricCard
          icon={Server}
          title={t("serviceCount")}
          value={
            new Set(backoffice.serviceEndpoints.map((item) => item.serviceId))
              .size
          }
        />
      </div>
      <EndpointsTable
        data={backoffice.serviceEndpoints}
        canViewDetail={canViewDetail}
      />
      <p className="text-xs text-muted-foreground">{common("sessionNotice")}</p>
    </div>
  )
}

export function ServiceEndpointDetailPage({
  endpointId,
}: {
  endpointId: string
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const access = useServiceResourceAccess()
  const router = useRouter()
  const t = useTranslations("backoffice.endpoints")
  const common = useTranslations("backoffice.common")
  const errors = useTranslations("backoffice.errors")
  const labels = useBackofficeLabels()
  const endpoint = backoffice.serviceEndpoints.find(
    (item) => item.id === endpointId,
  )
  if (!endpoint) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          sessionAccess.canAccessUiResource(
            uiResourceKeys.serviceEndpoints.list.key,
          ) ? (
            <Button render={<Link href="/service-endpoints" />}>
              {common("backToList")}
            </Button>
          ) : undefined
        }
      />
    )
  }
  const service = backoffice.services.find(
    (item) => item.id === endpoint.serviceId,
  )
  if (!service) {
    throw new Error(`Endpoint service not found: ${endpoint.id}`)
  }
  const resolvedEndpointId = endpoint.id
  const canManage = canManageService(access, service)
  const canUpdate =
    canManage &&
    sessionAccess.canAccessUiResource(
      uiResourceKeys.serviceEndpoints.detail.actions.updateEndpoint,
    )
  const canDelete =
    canManage &&
    sessionAccess.canAccessUiResource(
      uiResourceKeys.serviceEndpoints.detail.actions.deleteEndpoint,
    )
  const endpointFields = backoffice.serviceEndpointFields.filter(
    (field) => field.endpointId === endpoint.id,
  )
  const requestParameters = endpointFields.filter((field) =>
    ["path", "query", "header"].includes(field.location),
  )
  const requestBodyFields = endpointFields.filter(
    (field) => field.location === "request-body",
  )
  const responseBodyFields = endpointFields.filter(
    (field) => field.location === "response-body",
  )

  async function removeEndpoint() {
    const result = await backoffice.deleteServiceEndpoint(resolvedEndpointId)
    if (!result.ok) {
      snackbar.error(errors(result.error))
      return
    }
    snackbar.success(t("deleted"))
    router.push("/service-endpoints")
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={endpoint.name}
        description={t("detailDescription")}
        actions={
          canUpdate || canDelete ? (
            <>
              {canUpdate ? <EndpointEditDialog endpoint={endpoint} /> : null}
              {canDelete ? (
                <ConfirmAction
                  trigger={
                    <>
                      <Trash2 />
                      {common("delete")}
                    </>
                  }
                  title={t("deleteTitle", { name: endpoint.name })}
                  description={t("deleteDescription", {
                    name: endpoint.name,
                  })}
                  confirmLabel={common("delete")}
                  cancelLabel={common("cancel")}
                  onConfirm={removeEndpoint}
                />
              ) : null}
            </>
          ) : null
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("detailTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailItem label={t("service")}>
              <UiResourceLink
                resourceKey={uiResourceKeys.services.detail.key}
                href={`/services/${service.id}`}
                className="font-medium text-primary hover:underline"
              >
                {service.name}
              </UiResourceLink>
            </DetailItem>
            <DetailItem label={t("method")}>{endpoint.method}</DetailItem>
            <DetailItem label={t("path")}>
              <a
                href={new URL(endpoint.path, service.host).toString()}
                target="_blank"
                rel="noreferrer"
                className="break-all text-primary hover:underline"
              >
                {endpoint.path}
              </a>
            </DetailItem>
            <DetailItem label={common("createdAt")}>
              {labels.dateTime(endpoint.createdAt)}
            </DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("requestParameters")}</CardTitle>
          <CardDescription>{t("requestParametersDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <EndpointFieldsTable
            fields={requestParameters}
            caption={t("requestParameters")}
            empty={t("requestParametersEmpty")}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("requestBodyFields")}</CardTitle>
          <CardDescription>{t("requestBodyFieldsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <EndpointFieldsTable
            fields={requestBodyFields}
            caption={t("requestBodyFields")}
            empty={t("bodyFieldsEmpty")}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("responseBodyFields")}</CardTitle>
          <CardDescription>
            {t("responseBodyFieldsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EndpointFieldsTable
            fields={responseBodyFields}
            caption={t("responseBodyFields")}
            empty={t("bodyFieldsEmpty")}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export function ServiceDetailPage({ serviceId }: { serviceId: string }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const access = useServiceResourceAccess()
  const router = useRouter()
  const t = useTranslations("backoffice.services")
  const credentialsT = useTranslations("backoffice.apiKeys")
  const common = useTranslations("backoffice.common")
  const errors = useTranslations("backoffice.errors")
  const labels = useBackofficeLabels()
  const service = backoffice.services.find((item) => item.id === serviceId)
  if (!service)
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          sessionAccess.canAccessUiResource(
            uiResourceKeys.services.list.key,
          ) ? (
            <Button render={<Link href="/services" />}>
              {common("backToList")}
            </Button>
          ) : undefined
        }
      />
    )
  const owner = backoffice.organizations.find(
    (item) => item.id === service.ownerOrganizationId,
  )
  const endpoints = backoffice.serviceEndpoints.filter(
    (item) => item.serviceId === service.id,
  )
  const canManage = canManageService(access, service)
  const canUpdate =
    canManage &&
    sessionAccess.canAccessUiResource(
      uiResourceKeys.services.detail.actions.updateService,
    )
  const canDelete =
    canManage &&
    sessionAccess.canAccessUiResource(
      uiResourceKeys.services.detail.actions.deleteService,
    )
  const canRequestCredential =
    service.status === "active" &&
    !sessionAccess.ownedCredentialServiceIds.includes(service.id) &&
    backoffice.approvalLines.some(
      (line) =>
        line.status === "active" &&
        line.id === service.credentialTemplateIds.issuance &&
        line.category === "credential" &&
        line.type === "api-key",
    )
  const canViewEndpointDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.serviceEndpoints.detail.key,
  )

  async function removeService() {
    const result = await backoffice.deleteService(serviceId)
    if (!result.ok) {
      snackbar.error(errors(result.error))
      return
    }
    snackbar.success(t("deleted"))
    router.push("/services")
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={service.name}
        description={t("detailDescription")}
        actions={
          <>
            {sessionAccess.ownedCredentialServiceIds.includes(
              service.id,
            ) ? null : canRequestCredential ? (
              <ApiKeyIssuanceDialog
                templates={backoffice.approvalLines}
                initialServiceId={service.id}
                triggerLabel={credentialsT("requestFromDetail")}
                excludedServiceIds={sessionAccess.ownedCredentialServiceIds}
              />
            ) : (
              <Button disabled>{credentialsT("requestFromDetail")}</Button>
            )}
            {canUpdate || canDelete ? (
              <>
                {canUpdate ? <ServiceEditDialog service={service} /> : null}
                {canDelete ? (
                  <ConfirmAction
                    trigger={
                      <>
                        <Trash2 />
                        {common("delete")}
                      </>
                    }
                    title={t("deleteTitle", { name: service.name })}
                    description={t("deleteDescription", {
                      name: service.name,
                    })}
                    confirmLabel={common("delete")}
                    cancelLabel={common("cancel")}
                    onConfirm={removeService}
                  />
                ) : null}
              </>
            ) : null}
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("detailTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailItem label={common("code")}>{service.code}</DetailItem>
            <DetailItem label={t("host")}>{service.host}</DetailItem>
            <DetailItem label={t("type")}>
              <ServiceTypeBadge type={service.type} />
            </DetailItem>
            <DetailItem label={t("owner")}>{owner?.name}</DetailItem>
            <DetailItem label={t("credentialIssuanceTemplate")}>
              {
                backoffice.approvalLines.find(
                  (template) =>
                    template.id === service.credentialTemplateIds.issuance,
                )?.name
              }
            </DetailItem>
            <DetailItem label={t("credentialReplacementTemplate")}>
              {
                backoffice.approvalLines.find(
                  (template) =>
                    template.id === service.credentialTemplateIds.replacement,
                )?.name
              }
            </DetailItem>
            <DetailItem label={t("credentialDisposalTemplate")}>
              {
                backoffice.approvalLines.find(
                  (template) =>
                    template.id === service.credentialTemplateIds.disposal,
                )?.name
              }
            </DetailItem>
            <DetailItem label={common("status")}>
              <StatusBadge status={service.status} />
            </DetailItem>
            <DetailItem label={common("createdAt")}>
              {labels.dateTime(service.createdAt)}
            </DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>
      {service.type === "internal" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("endpoints")}</CardTitle>
            <CardDescription>{t("endpointsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <EndpointsTable
              data={endpoints}
              showService={false}
              canViewDetail={canViewEndpointDetail}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
