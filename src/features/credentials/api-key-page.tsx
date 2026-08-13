"use client"

import { uiResourceKeys } from "@/config/menu-registry"
import type { ColumnDef } from "@tanstack/react-table"
import { KeyRound, LoaderCircle, Server } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import {
  resolveCredentialVisibility,
  type CredentialRequest,
} from "@/auth/credential-access"
import { useSessionAccess } from "@/auth/session-access-provider"
import { UiResourceLink } from "@/auth/ui-resource-link"
import { EmptyState } from "@/components/patterns/content-state"
import { DataTable } from "@/components/patterns/data-table"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import {
  FormDialog,
  FormDialogContent,
} from "@/components/patterns/form-dialog"
import { MetricCard } from "@/components/patterns/metric-card"
import { PageHeader } from "@/components/patterns/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import { ApiKeyIssuanceDialog } from "@/features/credentials/api-key-issuance-dialog"
import { ApiKeyLifecycleDialog } from "@/features/credentials/api-key-lifecycle-dialog"
import type { ApprovalDocument } from "@/features/access-policies/model"
import { apiKeySecretSchema, type ApiKey } from "@/features/credentials/model"
import { useBackoffice } from "@/application/state/provider"
import {
  ApprovalStatusBadge,
  ServiceTypeBadge,
  StatusBadge,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

type IssuedSecret = {
  keyName: string
  value: string
}

export function ApiKeyPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.apiKeys")
  const documentsT = useTranslations("backoffice.approvalDocuments")
  const common = useTranslations("backoffice.common")
  const errorsT = useTranslations("backoffice.errors")
  const labels = useBackofficeLabels()
  const canViewDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.apiKeys.detail.key,
  )
  const [issuedSecret, setIssuedSecret] = useState<IssuedSecret>()
  const [registrationDocument, setRegistrationDocument] =
    useState<CredentialRequest>()
  const [manualSecret, setManualSecret] = useState("")
  const [manualSecretInvalid, setManualSecretInvalid] = useState(false)
  const [registrationPending, setRegistrationPending] = useState(false)

  async function approve(document: CredentialRequest) {
    const result = await backoffice.approveApprovalDocument(document.id)
    if (!result.ok) {
      snackbar.error(errorsT(result.error))
      return
    }
    snackbar.success(documentsT("approved"))
  }

  async function register() {
    if (!registrationDocument) {
      throw new TypeError(
        "Credential registration requires an issuance request.",
      )
    }
    const registeredByUserId = sessionAccess.currentUser?.id
    if (!registeredByUserId) {
      snackbar.error(errorsT("invalid-input"))
      return
    }
    const service = backoffice.services.find(
      (item) => item.id === requestServiceId(registrationDocument),
    )
    if (!service) {
      snackbar.error(errorsT("service-not-found"))
      return
    }
    if (
      service.type === "external" &&
      !apiKeySecretSchema.safeParse(manualSecret).success
    ) {
      setManualSecretInvalid(true)
      return
    }
    setRegistrationPending(true)
    try {
      const result = await backoffice.registerApiKey({
        approvalDocumentId: registrationDocument.id,
        registeredByUserId,
        secret: service.type === "external" ? manualSecret : undefined,
      })
      if (!result.ok) {
        snackbar.error(errorsT(result.error))
        return
      }
      if (result.value.secret !== null) {
        setIssuedSecret({
          keyName: result.value.apiKey.name,
          value: result.value.secret,
        })
      }
      setRegistrationDocument(undefined)
      setManualSecret("")
      setManualSecretInvalid(false)
      snackbar.success(t("registered"))
    } finally {
      setRegistrationPending(false)
    }
  }

  const credentialTemplates = backoffice.approvalLines.filter(
    (line) =>
      line.status === "active" &&
      line.category === "credential" &&
      line.type === "api-key",
  )
  const visibility = useMemo(
    () =>
      resolveCredentialVisibility(
        backoffice,
        sessionAccess.currentUser?.id ?? null,
      ),
    [sessionAccess.currentUser?.id, backoffice],
  )
  const issuanceRequests = visibility.requests
  const credentials = visibility.credentials.map((item) => item.credential)
  const isAdministrator = sessionAccess.effectiveRoles.some(
    (role) => role.id === backoffice.systemReferences.roleIds.administrator,
  )
  const canApproveCredentialRequest = sessionAccess.canAccessUiResource(
    uiResourceKeys.apiKeys.list.actions.approveCredentialRequest,
  )
  const canRegisterCredentialResource = sessionAccess.canAccessUiResource(
    uiResourceKeys.apiKeys.list.actions.registerCredential,
  )
  function requestApiKey(document: CredentialRequest) {
    return document.documentKind === "api-key-lifecycle"
      ? backoffice.apiKeys.find((item) => item.id === document.apiKeyId)
      : undefined
  }
  function requestServiceId(document: CredentialRequest) {
    return document.documentKind === "api-key-issuance"
      ? document.serviceId
      : requestApiKey(document)?.serviceId
  }
  function requestKeyName(document: CredentialRequest) {
    return document.documentKind === "api-key-issuance"
      ? document.keyName
      : (requestApiKey(document)?.name ?? "")
  }
  function requestAwsSecretName(document: CredentialRequest) {
    return document.type === "api-key-dispose" ? "" : document.awsSecretName
  }
  function requestAwsSecretKey(document: CredentialRequest) {
    return document.type === "api-key-dispose" ? "" : document.awsSecretKey
  }
  function canRegisterCredential(document: CredentialRequest) {
    if (document.type === "api-key-dispose") return false
    const serviceId = requestServiceId(document)
    const service = backoffice.services.find((item) => item.id === serviceId)
    if (!service)
      throw new Error(`Credential service not found: ${document.id}`)
    const user = sessionAccess.currentUser
    return (
      canRegisterCredentialResource &&
      user?.employmentStatus === "employed" &&
      (isAdministrator ||
        user.organizationIds.includes(service.ownerOrganizationId))
    )
  }
  const registrationService = registrationDocument
    ? backoffice.services.find(
        (service) => service.id === requestServiceId(registrationDocument),
      )
    : undefined
  const registrationOwner = registrationService
    ? backoffice.organizations.find(
        (organization) =>
          organization.id === registrationService.ownerOrganizationId,
      )
    : undefined
  const requestColumns: ColumnDef<CredentialRequest>[] = [
    {
      accessorKey: "type",
      header: t("requestType"),
      cell: ({ row }) => labels.approvalType(row.original.type),
    },
    {
      id: "keyName",
      header: t("keyName"),
      cell: ({ row }) => requestKeyName(row.original),
    },
    {
      id: "service",
      header: t("service"),
      cell: ({ row }) => {
        const service = backoffice.services.find(
          (item) => item.id === requestServiceId(row.original),
        )
        if (!service) {
          throw new Error(`Credential service not found: ${row.original.id}`)
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
    },
    {
      id: "requester",
      header: documentsT("requester"),
      cell: ({ row }) => {
        const requester = backoffice.users.find(
          (item) => item.id === row.original.requesterId,
        )
        if (!requester) {
          throw new Error(
            `Credential requester not found: ${row.original.requesterId}`,
          )
        }
        return (
          <UiResourceLink
            resourceKey={uiResourceKeys.users.detail.key}
            href={`/users/${requester.id}`}
            className="text-primary hover:underline"
          >
            {requester.nickname}
          </UiResourceLink>
        )
      },
    },
    {
      accessorKey: "status",
      header: common("status"),
      cell: ({ row }) => <ApprovalStatusBadge status={row.original.status} />,
    },
    {
      id: "registrationStatus",
      header: t("registrationStatus"),
      cell: ({ row }) => {
        const registered = credentials.some(
          (apiKey) => apiKey.approvalDocumentId === row.original.id,
        )
        if (registered) {
          return <Badge variant="success">{t("registeredStatus")}</Badge>
        }
        if (
          row.original.type === "api-key-dispose" &&
          row.original.status === "approved"
        ) {
          return <Badge variant="secondary">{t("disposedStatus")}</Badge>
        }
        if (
          row.original.status === "approved" &&
          row.original.type !== "api-key-dispose"
        ) {
          return <Badge variant="warning">{t("registrationPending")}</Badge>
        }
        return "—"
      },
    },
    {
      id: "action",
      header: "",
      cell: ({ row }) =>
        row.original.status === "submitted" && canApproveCredentialRequest ? (
          <Button
            size="sm"
            onClick={() => {
              void approve(row.original)
            }}
          >
            {documentsT("approve")}
          </Button>
        ) : row.original.status === "approved" &&
          !credentials.some(
            (apiKey) => apiKey.approvalDocumentId === row.original.id,
          ) &&
          canRegisterCredential(row.original) ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setRegistrationDocument(row.original)
            }}
          >
            {t("register")}
          </Button>
        ) : null,
    },
  ]
  const columns = useMemo<ColumnDef<ApiKey>[]>(
    () => [
      { accessorKey: "name", header: t("keyName") },
      {
        id: "service",
        header: t("service"),
        cell: ({ row }) => {
          const service = backoffice.services.find(
            (item) => item.id === row.original.serviceId,
          )
          if (!service) {
            throw new Error(`Credential service not found: ${row.original.id}`)
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
      },
      {
        id: "document",
        header: t("approvalDocument"),
        cell: ({ row }) =>
          backoffice.approvalDocuments.find(
            (item) => item.id === row.original.approvalDocumentId,
          )?.title,
      },
      {
        id: "status",
        header: common("status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "createdAt",
        header: t("createdAt"),
        cell: ({ row }) => labels.dateTime(row.original.createdAt),
      },
    ],
    [common, labels, t, backoffice],
  )

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          credentialTemplates.length > 0 ? (
            <ApiKeyIssuanceDialog
              templates={credentialTemplates}
              triggerLabel={t("request")}
              excludedServiceIds={sessionAccess.ownedCredentialServiceIds}
            />
          ) : (
            <Button disabled>{t("request")}</Button>
          )
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={KeyRound}
          title={t("total")}
          value={credentials.length}
        />
        <MetricCard
          icon={KeyRound}
          title={t("activeCount")}
          value={credentials.filter((item) => item.status === "active").length}
        />
        <MetricCard
          icon={Server}
          title={t("serviceCount")}
          value={new Set(credentials.map((item) => item.serviceId)).size}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("issuanceHistoryTitle")}</CardTitle>
          <CardDescription>{t("issuanceHistoryDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            caption={t("issuanceHistoryCaption")}
            columns={requestColumns}
            data={issuanceRequests}
            getRowId={(row) => row.id}
            empty={t("issuanceHistoryEmpty")}
            filterLabel={common("search")}
            noResults={common("noResults")}
            filters={[
              {
                id: "request-key-name",
                label: t("keyName"),
                getValue: requestKeyName,
              },
              {
                id: "request-service",
                label: t("service"),
                getValue: (row) =>
                  backoffice.services.find(
                    (item) => item.id === requestServiceId(row),
                  )?.name ?? "",
              },
              {
                id: "requester",
                label: documentsT("requester"),
                getValue: (row) =>
                  backoffice.users.find((item) => item.id === row.requesterId)
                    ?.nickname ?? "",
              },
              {
                id: "request-status",
                label: common("status"),
                getValue: (row) =>
                  row.status === "draft"
                    ? documentsT("draft")
                    : row.status === "approved"
                      ? documentsT("approvedStatus")
                      : documentsT("submittedStatus"),
              },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("credentialListTitle")}</CardTitle>
          <CardDescription>{t("credentialListDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            caption={t("tableCaption")}
            columns={columns}
            data={credentials}
            getRowId={(row) => row.id}
            getRowHref={(row) =>
              canViewDetail ? `/api-keys/${row.id}` : undefined
            }
            getRowLabel={(row) => `${row.name} ${common("details")}`}
            empty={t("empty")}
            filterLabel={common("search")}
            noResults={common("noResults")}
            filters={[
              {
                id: "credential-name",
                label: t("keyName"),
                getValue: (row) => row.name,
              },
              {
                id: "credential-service",
                label: t("service"),
                getValue: (row) =>
                  backoffice.services.find((item) => item.id === row.serviceId)
                    ?.name ?? "",
              },
            ]}
          />
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{common("sessionNotice")}</p>

      <FormDialog
        open={Boolean(registrationDocument)}
        hasChanges={manualSecret.length > 0}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !registrationPending) {
            setRegistrationDocument(undefined)
            setManualSecret("")
            setManualSecretInvalid(false)
          }
        }}
      >
        <FormDialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(
                registrationService?.type === "external"
                  ? "externalRegisterTitle"
                  : "internalRegisterTitle",
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                registrationService?.type === "external"
                  ? "externalRegisterDescription"
                  : "internalRegisterDescription",
              )}
            </DialogDescription>
          </DialogHeader>
          {registrationService ? (
            <div className="grid gap-4">
              <Alert variant="info">
                <Server aria-hidden="true" />
                <AlertTitle className="flex items-center gap-2">
                  {registrationService.name}
                  <ServiceTypeBadge type={registrationService.type} />
                </AlertTitle>
                <AlertDescription>
                  {t("registrationOwner", {
                    organization: registrationOwner?.name ?? "—",
                  })}
                </AlertDescription>
              </Alert>
              <DetailGrid>
                <DetailItem label={t("awsSecretName")}>
                  {registrationDocument
                    ? requestAwsSecretName(registrationDocument)
                    : ""}
                </DetailItem>
                <DetailItem label={t("awsSecretKey")}>
                  {registrationDocument
                    ? requestAwsSecretKey(registrationDocument)
                    : ""}
                </DetailItem>
              </DetailGrid>
              {registrationService.type === "external" ? (
                <Field invalid={manualSecretInvalid}>
                  <FieldLabel htmlFor="external-api-key-secret">
                    {t("externalSecretLabel")}
                  </FieldLabel>
                  <Input
                    id="external-api-key-secret"
                    type="password"
                    autoComplete="off"
                    minLength={8}
                    maxLength={4096}
                    required
                    value={manualSecret}
                    aria-invalid={manualSecretInvalid}
                    onChange={(event) => {
                      setManualSecret(event.currentTarget.value)
                      setManualSecretInvalid(false)
                    }}
                  />
                  <FieldDescription>
                    {t("externalSecretDescription")}
                  </FieldDescription>
                  {manualSecretInvalid ? (
                    <FieldError>{t("externalSecretError")}</FieldError>
                  ) : null}
                </Field>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("internalRegistrationNotice")}
                </p>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" disabled={registrationPending} />
              }
            >
              {common("cancel")}
            </DialogClose>
            <Button
              disabled={registrationPending}
              aria-busy={registrationPending}
              onClick={() => void register()}
            >
              {registrationPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : null}
              {t(
                registrationService?.type === "external"
                  ? "externalRegisterAction"
                  : "internalRegisterAction",
              )}
            </Button>
          </DialogFooter>
        </FormDialogContent>
      </FormDialog>

      <Dialog
        open={Boolean(issuedSecret)}
        onOpenChange={(open) => {
          if (!open) setIssuedSecret(undefined)
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{documentsT("issuedSecretTitle")}</DialogTitle>
            <DialogDescription>
              {documentsT("issuedSecretDescription")}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="issued-api-key-secret">
              {documentsT("issuedSecretLabel")}
            </FieldLabel>
            <Input
              id="issued-api-key-secret"
              value={issuedSecret?.value ?? ""}
              readOnly
              aria-describedby="issued-api-key-name"
            />
            <p
              id="issued-api-key-name"
              className="text-xs text-muted-foreground"
            >
              {issuedSecret?.keyName}
            </p>
          </Field>
          <DialogFooter>
            <DialogClose render={<Button />}>
              {documentsT("closeSecret")}
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ApiKeyDetailPage({ apiKeyId }: { apiKeyId: string }) {
  const backoffice = useBackoffice()
  const session = useSessionAccess()
  const t = useTranslations("backoffice.apiKeys")
  const documentsT = useTranslations("backoffice.approvalDocuments")
  const common = useTranslations("backoffice.common")
  const labels = useBackofficeLabels()
  const visibleApiKey = useMemo(
    () =>
      resolveCredentialVisibility(
        backoffice,
        session.currentUser?.id ?? null,
      ).credentials.find((item) => item.credential.id === apiKeyId)?.credential,
    [apiKeyId, session.currentUser?.id, backoffice],
  )

  if (!visibleApiKey) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          session.canAccessUiResource(uiResourceKeys.apiKeys.list.key) ? (
            <Button render={<Link href="/api-keys" />}>
              {common("backToList")}
            </Button>
          ) : undefined
        }
      />
    )
  }

  const service = backoffice.services.find(
    (item) => item.id === visibleApiKey.serviceId,
  )
  if (!service) throw new Error(`Credential service not found: ${apiKeyId}`)
  const registeredBy = backoffice.users.find(
    (item) => item.id === visibleApiKey.registeredByUserId,
  )
  const history = backoffice.approvalDocuments
    .filter(
      (document) =>
        document.id === visibleApiKey.approvalDocumentId ||
        (document.documentKind === "api-key-lifecycle" &&
          document.apiKeyId === visibleApiKey.id),
    )
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
  const replacementTemplate = backoffice.approvalLines.find(
    (template) =>
      template.id === service.credentialTemplateIds.replacement &&
      template.status === "active" &&
      template.type === "api-key-replace",
  )
  const disposalTemplate = backoffice.approvalLines.find(
    (template) =>
      template.id === service.credentialTemplateIds.disposal &&
      template.status === "active" &&
      template.type === "api-key-dispose",
  )
  const submittedTypes = new Set(
    history
      .filter((document) => document.status === "submitted")
      .map((document) => document.type),
  )
  const historyColumns: ColumnDef<ApprovalDocument>[] = [
    {
      accessorKey: "type",
      header: t("requestType"),
      cell: ({ row }) => labels.approvalType(row.original.type),
    },
    { accessorKey: "title", header: t("requestTitleColumn") },
    {
      accessorKey: "requesterId",
      header: documentsT("requester"),
      cell: ({ row }) => {
        const requester = backoffice.users.find(
          (item) => item.id === row.original.requesterId,
        )
        return requester ? (
          <UiResourceLink
            resourceKey={uiResourceKeys.users.detail.key}
            href={`/users/${requester.id}`}
            className="text-primary hover:underline"
          >
            {requester.nickname}
          </UiResourceLink>
        ) : null
      },
    },
    {
      accessorKey: "status",
      header: common("status"),
      cell: ({ row }) => <ApprovalStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: common("createdAt"),
      cell: ({ row }) => labels.dateTime(row.original.createdAt),
    },
  ]

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={visibleApiKey.name}
        description={t("detailDescription")}
        actions={
          visibleApiKey.status === "active" ? (
            <>
              {replacementTemplate && !submittedTypes.has("api-key-replace") ? (
                <ApiKeyLifecycleDialog
                  apiKey={visibleApiKey}
                  template={replacementTemplate}
                  type="api-key-replace"
                />
              ) : (
                <Button disabled>{t("requestReplacement")}</Button>
              )}
              {disposalTemplate && !submittedTypes.has("api-key-dispose") ? (
                <ApiKeyLifecycleDialog
                  apiKey={visibleApiKey}
                  template={disposalTemplate}
                  type="api-key-dispose"
                />
              ) : (
                <Button disabled>{t("requestDisposal")}</Button>
              )}
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
            <DetailItem label={t("keyName")}>{visibleApiKey.name}</DetailItem>
            <DetailItem label={t("service")}>
              <UiResourceLink
                resourceKey={uiResourceKeys.services.detail.key}
                href={`/services/${service.id}`}
                className="text-primary hover:underline"
              >
                {service.name}
              </UiResourceLink>
            </DetailItem>
            <DetailItem label={common("status")}>
              <StatusBadge status={visibleApiKey.status} />
            </DetailItem>
            <DetailItem label={t("registeredBy")}>
              {registeredBy?.nickname ?? "—"}
            </DetailItem>
            <DetailItem label={t("awsSecretName")}>
              {visibleApiKey.awsSecretName}
            </DetailItem>
            <DetailItem label={t("awsSecretKey")}>
              {visibleApiKey.awsSecretKey}
            </DetailItem>
            <DetailItem
              label={t("allowedEndpoints")}
              className="sm:col-span-2 sm:border-r-0"
            >
              {visibleApiKey.endpointIds.length > 0 ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {visibleApiKey.endpointIds.map((endpointId) => {
                    const endpoint = backoffice.serviceEndpoints.find(
                      (item) => item.id === endpointId,
                    )
                    if (!endpoint) {
                      throw new Error(
                        `Credential endpoint not found: ${endpointId}`,
                      )
                    }
                    return (
                      <li key={endpoint.id}>
                        <UiResourceLink
                          resourceKey={
                            uiResourceKeys.serviceEndpoints.detail.key
                          }
                          href={`/service-endpoints/${endpoint.id}`}
                          className="inline-flex max-w-full items-center gap-2 rounded-control border border-border-subtle px-2 py-1 hover:bg-control-hover"
                        >
                          <Badge variant="outline">{endpoint.method}</Badge>
                          <code className="truncate text-xs">
                            {endpoint.path}
                          </code>
                        </UiResourceLink>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                t("serviceLevelCredential")
              )}
            </DetailItem>
            <DetailItem label={t("createdAt")}>
              {labels.dateTime(visibleApiKey.createdAt)}
            </DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("requestHistoryTitle")}</CardTitle>
          <CardDescription>{t("requestHistoryDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            caption={t("requestHistoryCaption")}
            columns={historyColumns}
            data={history}
            getRowId={(row) => row.id}
            empty={t("requestHistoryEmpty")}
          />
        </CardContent>
      </Card>
    </div>
  )
}
