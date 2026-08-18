"use client"

import { requestCategoryValues } from "@/features/request-templates/model"
import { approvalTypeValues } from "@/features/request-templates/model"
import { serviceTypeValues } from "@/features/service-catalog/model"
import { entityStatuses } from "@/domain/common"
import { uiResourceKeys } from "@/config/menu-registry"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Cloud,
  KeyRound,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { UiResourceLink } from "@/auth/ui-resource-link"
import { canManageService } from "@/auth/service-resource-access"
import { ConfirmAction } from "@/components/patterns/confirm-action"
import { EmptyState } from "@/components/patterns/content-state"
import {
  DataTable,
  type DataTableFilter,
} from "@/components/patterns/data-table"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import { MetricCard } from "@/components/patterns/metric-card"
import { PageHeader } from "@/components/patterns/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { snackbar } from "@/components/ui/snackbar"
import {
  endpointFieldLocationValues,
  endpointLifecycleValues,
  isEndpointRequestParameterLocation,
  type ManagedService,
  type ServiceEndpoint,
  type ServiceEndpointField,
  type ServiceEndpointRevision,
} from "@/features/service-catalog/model"
import { useBackoffice } from "@/application/state/provider"
import { useServiceResourceAccess } from "@/features/service-catalog/use-service-resource-access"
import { resolveEndpointReferencedPolicyIds } from "@/features/service-catalog/endpoint-impact"
import { EndpointReferencedPoliciesTable } from "@/features/service-catalog/endpoint-impact-view"
import {
  ServiceTypeBadge,
  StatusBadge,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

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
      { accessorKey: "serviceKey", header: t("serviceKey") },
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
          id: "service-key",
          label: t("serviceKey"),
          getValue: (row) => row.serviceKey,
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
        actions={
          canRegister ? (
            <Button nativeButton={false} render={<Link href="/services/new" />}>
              <Plus />
              {t("add")}
            </Button>
          ) : null
        }
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
            backoffice.services.filter(
              (item) => item.type === serviceTypeValues.internal,
            ).length
          }
        />
        <MetricCard
          icon={Cloud}
          title={t("externalCount")}
          value={
            backoffice.services.filter(
              (item) => item.type === serviceTypeValues.external,
            ).length
          }
        />
      </div>
      <ServicesTable data={backoffice.services} canViewDetail={canViewDetail} />
      <p className="text-xs text-muted-foreground">{common("sessionNotice")}</p>
    </div>
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
      { accessorKey: "version", header: t("version"), size: 96 },
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
      {
        accessorKey: "lifecycle",
        header: common("status"),
        size: 112,
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.lifecycle === entityStatuses.active
                ? "success"
                : "warning"
            }
          >
            {t(row.original.lifecycle)}
          </Badge>
        ),
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
      {
        id: "endpoint-status",
        label: common("status"),
        getValue: (row) => t(row.lifecycle),
      },
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
        service.status === entityStatuses.active &&
        service.type === serviceTypeValues.internal &&
        canManageService(access, service),
    )
  const canViewDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.serviceEndpoints.detail.key,
  )
  const canSynchronize =
    sessionAccess.canAccessUiResource(
      uiResourceKeys.serviceEndpoints.list.actions.syncEndpoints,
    ) &&
    sessionAccess.canAccessUiResource(uiResourceKeys.serviceEndpoints.sync.key)
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          canRegister || canSynchronize ? (
            <>
              {canSynchronize ? (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/service-endpoints/sync" />}
                >
                  <RefreshCw />
                  {t("syncOpenApi")}
                </Button>
              ) : null}
              {canRegister ? (
                <Button
                  nativeButton={false}
                  render={<Link href="/service-endpoints/new" />}
                >
                  <Plus />
                  {t("add")}
                </Button>
              ) : null}
            </>
          ) : null
        }
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
  const endpointLifecycle = endpoint.lifecycle
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
  const canChangeLifecycle =
    canManage &&
    sessionAccess.canAccessUiResource(
      uiResourceKeys.serviceEndpoints.detail.actions.changeEndpointLifecycle,
    )
  const endpointFields = backoffice.serviceEndpointFields.filter(
    (field) => field.endpointId === endpoint.id,
  )
  const endpointRevisions = backoffice.serviceEndpointRevisions
    .filter((revision) => revision.endpointId === endpoint.id)
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
  const referencedPolicyIds = resolveEndpointReferencedPolicyIds(
    backoffice,
    endpoint.id,
  )
  const revisionColumns: ColumnDef<ServiceEndpointRevision>[] = [
    {
      accessorKey: "version",
      header: t("version"),
      size: 120,
    },
    {
      id: "methodPath",
      header: `${t("method")} / ${t("path")}`,
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-2">
          <Badge variant="outline">{row.original.endpoint.method}</Badge>
          <code className="truncate" title={row.original.endpoint.path}>
            {row.original.endpoint.path}
          </code>
        </span>
      ),
    },
    {
      id: "fields",
      header: t("fieldTotal"),
      size: 120,
      cell: ({ row }) => t("fieldCount", { count: row.original.fields.length }),
    },
    {
      accessorKey: "createdAt",
      header: common("createdAt"),
      size: 180,
      cell: ({ row }) => labels.dateTime(row.original.createdAt),
    },
  ]
  const requestParameters = endpointFields.filter((field) =>
    isEndpointRequestParameterLocation(field.location),
  )
  const requestBodyFields = endpointFields.filter(
    (field) => field.location === endpointFieldLocationValues.requestBody,
  )
  const responseBodyFields = endpointFields.filter(
    (field) => field.location === endpointFieldLocationValues.responseBody,
  )

  async function removeEndpoint() {
    const result = await backoffice.deleteServiceEndpoint(
      resolvedEndpointId,
      sessionAccess.currentUser?.id ?? "",
    )
    if (!result.ok) {
      snackbar.error(errors(result.error))
      return
    }
    snackbar.success(t("deleted"))
    router.push("/service-endpoints")
  }

  async function changeLifecycle() {
    const result = await backoffice.setServiceEndpointLifecycle(
      resolvedEndpointId,
      endpointLifecycle === entityStatuses.active
        ? endpointLifecycleValues.deprecated
        : endpointLifecycleValues.active,
      sessionAccess.currentUser?.id ?? "",
    )
    if (!result.ok) {
      snackbar.error(errors(result.error))
      return
    }
    snackbar.success(
      t(
        result.value.lifecycle === entityStatuses.active
          ? "restored"
          : "deprecatedSuccess",
      ),
    )
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={endpoint.name}
        description={t("detailDescription")}
        actions={
          canUpdate || canDelete || canChangeLifecycle ? (
            <>
              {canUpdate ? (
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={
                    <Link href={`/service-endpoints/${endpoint.id}/edit`} />
                  }
                >
                  <Pencil />
                  {t("edit")}
                </Button>
              ) : null}
              {canChangeLifecycle ? (
                <ConfirmAction
                  trigger={t(
                    endpoint.lifecycle === entityStatuses.active
                      ? "deprecate"
                      : "restoreEndpoint",
                  )}
                  title={t(
                    endpoint.lifecycle === entityStatuses.active
                      ? "deprecateTitle"
                      : "restoreTitle",
                  )}
                  description={t(
                    endpoint.lifecycle === entityStatuses.active
                      ? "deprecateDescription"
                      : "restoreDescription",
                  )}
                  confirmLabel={t(
                    endpoint.lifecycle === entityStatuses.active
                      ? "deprecate"
                      : "restoreEndpoint",
                  )}
                  cancelLabel={common("cancel")}
                  onConfirm={changeLifecycle}
                />
              ) : null}
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
            <DetailItem label={t("version")}>{endpoint.version}</DetailItem>
            <DetailItem label={common("status")}>
              <Badge
                variant={
                  endpoint.lifecycle === entityStatuses.active
                    ? "success"
                    : "warning"
                }
              >
                {t(endpoint.lifecycle)}
              </Badge>
            </DetailItem>
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
          <CardTitle>{t("referencedPolicies")}</CardTitle>
          <CardDescription>
            {t("referencedPoliciesDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EndpointReferencedPoliciesTable policyIds={referencedPolicyIds} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("versionHistory")}</CardTitle>
          <CardDescription>{t("versionHistoryDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            caption={t("versionHistory")}
            columns={revisionColumns}
            data={endpointRevisions}
            getRowId={(row) => row.id}
            empty={t("versionHistoryEmpty")}
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
    service.status === entityStatuses.active &&
    sessionAccess.canAccessUiResource(uiResourceKeys.apiKeys.request.key) &&
    !sessionAccess.ownedCredentialServiceIds.includes(service.id) &&
    backoffice.approvalLines.some(
      (line) =>
        line.status === entityStatuses.active &&
        line.id === service.credentialTemplateIds.issuance &&
        line.category === requestCategoryValues.credential &&
        line.type === approvalTypeValues.apiKey,
    )
  const canViewEndpointDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.serviceEndpoints.detail.key,
  )

  async function removeService() {
    const result = await backoffice.deleteService(
      serviceId,
      sessionAccess.currentUser?.id ?? "",
    )
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
              <Button
                nativeButton={false}
                render={
                  <Link href={`/credentials/request?serviceId=${service.id}`} />
                }
              >
                <KeyRound />
                {credentialsT("requestFromDetail")}
              </Button>
            ) : (
              <Button disabled>{credentialsT("requestFromDetail")}</Button>
            )}
            {canUpdate || canDelete ? (
              <>
                {canUpdate ? (
                  <Button
                    nativeButton={false}
                    variant="outline"
                    render={<Link href={`/services/${service.id}/edit`} />}
                  >
                    <Pencil />
                    {t("edit")}
                  </Button>
                ) : null}
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
            <DetailItem label={t("serviceKey")}>
              <code>{service.serviceKey}</code>
            </DetailItem>
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
      {service.type === serviceTypeValues.internal ? (
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
