"use client"

import { approvalDocumentStatuses } from "@/features/access-policies/model"
import { requestCategoryValues } from "@/features/request-templates/model"
import { approvalTypeValues } from "@/features/request-templates/model"
import { approvalDocumentKinds } from "@/features/access-policies/model"
import { serviceTypeValues } from "@/features/service-catalog/model"
import { employmentStatusValues } from "@/features/iam/model"
import { entityStatuses } from "@/domain/common"
import { uiResourceKeys } from "@/config/menu-registry"
import type { ColumnDef } from "@tanstack/react-table"
import {
  CalendarClock,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react"
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
import type { ApprovalDocument } from "@/features/access-policies/model"
import { apiKeySecretSchema, type ApiKey } from "@/features/credentials/model"
import { useBackoffice } from "@/application/state/provider"
import {
  ApprovalStatusBadge,
  ServiceTypeBadge,
  StatusBadge,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"
import { CredentialEmergencyRevokeDialog } from "@/features/credentials/credential-operations"

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
  const canViewRequestDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.approvalDocuments.requestDetail.key,
  )
  const [issuedSecret, setIssuedSecret] = useState<IssuedSecret>()
  const [registrationDocument, setRegistrationDocument] =
    useState<CredentialRequest>()
  const [manualSecret, setManualSecret] = useState("")
  const [manualSecretInvalid, setManualSecretInvalid] = useState(false)
  const [registrationPending, setRegistrationPending] = useState(false)
  function requestStatusLabel(document: ApprovalDocument) {
    switch (document.status) {
      case approvalDocumentStatuses.draft:
        return documentsT("draft")
      case approvalDocumentStatuses.submitted:
        return documentsT("submittedStatus")
      case approvalDocumentStatuses.approved:
        return documentsT("approvedStatus")
      case approvalDocumentStatuses.rejected:
        return documentsT("rejectedStatus")
      case approvalDocumentStatuses.withdrawn:
        return documentsT("withdrawnStatus")
    }
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
      service.type === serviceTypeValues.external &&
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
        secret:
          service.type === serviceTypeValues.external
            ? manualSecret
            : undefined,
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
      line.status === entityStatuses.active &&
      line.category === requestCategoryValues.credential &&
      line.type === approvalTypeValues.apiKey,
  )
  const canRequestCredential = sessionAccess.canAccessUiResource(
    uiResourceKeys.apiKeys.request.key,
  )
  const canManageLifecycle =
    sessionAccess.canAccessUiResource(
      uiResourceKeys.apiKeys.lifecycleSettings.key,
    ) &&
    sessionAccess.canAccessUiResource(
      uiResourceKeys.apiKeys.lifecycleSettings.actions.updateLifecycleSettings,
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
  const canRegisterCredentialResource = sessionAccess.canAccessUiResource(
    uiResourceKeys.apiKeys.list.actions.registerCredential,
  )
  function requestApiKey(document: CredentialRequest) {
    return document.documentKind === approvalDocumentKinds.apiKeyLifecycle
      ? backoffice.apiKeys.find((item) => item.id === document.apiKeyId)
      : undefined
  }
  function requestServiceId(document: CredentialRequest) {
    return document.documentKind === approvalDocumentKinds.apiKeyIssuance
      ? document.serviceId
      : requestApiKey(document)?.serviceId
  }
  function requestKeyName(document: CredentialRequest) {
    return document.documentKind === approvalDocumentKinds.apiKeyIssuance
      ? document.keyName
      : (requestApiKey(document)?.name ?? "")
  }
  function requestAwsSecretName(document: CredentialRequest) {
    return document.type === approvalTypeValues.apiKeyDispose
      ? ""
      : document.awsSecretName
  }
  function requestAwsSecretKey(document: CredentialRequest) {
    return document.type === approvalTypeValues.apiKeyDispose
      ? ""
      : document.awsSecretKey
  }
  function canRegisterCredential(document: CredentialRequest) {
    if (document.type === approvalTypeValues.apiKeyDispose) return false
    const serviceId = requestServiceId(document)
    const service = backoffice.services.find((item) => item.id === serviceId)
    if (!service)
      throw new Error(`Credential service not found: ${document.id}`)
    const user = sessionAccess.currentUser
    return (
      canRegisterCredentialResource &&
      user?.employmentStatus === employmentStatusValues.employed &&
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
          row.original.type === approvalTypeValues.apiKeyDispose &&
          row.original.status === approvalDocumentStatuses.approved
        ) {
          return <Badge variant="secondary">{t("disposedStatus")}</Badge>
        }
        if (
          row.original.status === approvalDocumentStatuses.approved &&
          row.original.type !== approvalTypeValues.apiKeyDispose
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
        row.original.status === approvalDocumentStatuses.approved &&
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
        id: "application",
        header: t("application"),
        cell: ({ row }) => {
          const application = backoffice.applications.find(
            (item) => item.id === row.original.applicationId,
          )
          return application ? (
            <UiResourceLink
              resourceKey={uiResourceKeys.applications.detail.key}
              href={`/applications/${application.id}`}
              className="text-primary hover:underline"
            >
              {application.name}
            </UiResourceLink>
          ) : null
        },
      },
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
          <>
            {canManageLifecycle ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/credentials/lifecycle-settings" />}
              >
                <CalendarClock />
                {t("manageLifecycle")}
              </Button>
            ) : null}
            {canRequestCredential && credentialTemplates.length > 0 ? (
              <Button
                nativeButton={false}
                render={<Link href="/credentials/request" />}
              >
                <KeyRound />
                {t("request")}
              </Button>
            ) : (
              <Button disabled>{t("request")}</Button>
            )}
          </>
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
          value={
            credentials.filter((item) => item.status === entityStatuses.active)
              .length
          }
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
            getRowHref={(row) =>
              canViewRequestDetail
                ? `/approval-documents/requests/${row.id}`
                : undefined
            }
            getRowLabel={(row) => `${row.title} ${common("details")}`}
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
                getValue: requestStatusLabel,
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
              canViewDetail ? `/credentials/${row.id}` : undefined
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
                registrationService?.type === serviceTypeValues.external
                  ? "externalRegisterTitle"
                  : "internalRegisterTitle",
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                registrationService?.type === serviceTypeValues.external
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
              {registrationService.type === serviceTypeValues.external ? (
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
                registrationService?.type === serviceTypeValues.external
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
  const canViewRequestDetail = session.canAccessUiResource(
    uiResourceKeys.approvalDocuments.requestDetail.key,
  )
  const canRequestReplacement = session.canAccessUiResource(
    uiResourceKeys.apiKeys.replaceRequest.key,
  )
  const canRequestDisposal = session.canAccessUiResource(
    uiResourceKeys.apiKeys.disposeRequest.key,
  )
  const canEmergencyRevoke = session.canAccessUiResource(
    uiResourceKeys.apiKeys.detail.actions.emergencyRevokeCredential,
  )
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
            <Button nativeButton={false} render={<Link href="/credentials" />}>
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
  const application = backoffice.applications.find(
    (item) => item.id === visibleApiKey.applicationId,
  )
  if (!service) throw new Error(`Credential service not found: ${apiKeyId}`)
  const registeredBy = backoffice.users.find(
    (item) => item.id === visibleApiKey.registeredByUserId,
  )
  const history = backoffice.approvalDocuments
    .filter(
      (document) =>
        document.id === visibleApiKey.approvalDocumentId ||
        (document.documentKind === approvalDocumentKinds.apiKeyLifecycle &&
          document.apiKeyId === visibleApiKey.id),
    )
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
  const replacementTemplate = backoffice.approvalLines.find(
    (template) =>
      template.id === service.credentialTemplateIds.replacement &&
      template.status === entityStatuses.active &&
      template.type === approvalTypeValues.apiKeyReplace,
  )
  const disposalTemplate = backoffice.approvalLines.find(
    (template) =>
      template.id === service.credentialTemplateIds.disposal &&
      template.status === entityStatuses.active &&
      template.type === approvalTypeValues.apiKeyDispose,
  )
  const submittedTypes = new Set(
    history
      .filter(
        (document) => document.status === approvalDocumentStatuses.submitted,
      )
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
          visibleApiKey.status === entityStatuses.active ? (
            <>
              {canRequestReplacement &&
              replacementTemplate &&
              !submittedTypes.has("api-key-replace") ? (
                <Button
                  nativeButton={false}
                  render={
                    <Link href={`/credentials/${visibleApiKey.id}/replace`} />
                  }
                >
                  <RefreshCw />
                  {t("requestReplacement")}
                </Button>
              ) : (
                <Button disabled>{t("requestReplacement")}</Button>
              )}
              {canRequestDisposal &&
              disposalTemplate &&
              !submittedTypes.has("api-key-dispose") ? (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={
                    <Link href={`/credentials/${visibleApiKey.id}/dispose`} />
                  }
                >
                  <Trash2 />
                  {t("requestDisposal")}
                </Button>
              ) : (
                <Button disabled>{t("requestDisposal")}</Button>
              )}
              {canEmergencyRevoke ? (
                <CredentialEmergencyRevokeDialog credential={visibleApiKey} />
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
            <DetailItem label={t("keyName")}>{visibleApiKey.name}</DetailItem>
            <DetailItem label={t("application")}>
              {application ? (
                <UiResourceLink
                  resourceKey={uiResourceKeys.applications.detail.key}
                  href={`/applications/${application.id}`}
                  className="text-primary hover:underline"
                >
                  {application.name}
                </UiResourceLink>
              ) : (
                "—"
              )}
            </DetailItem>
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
            <DetailItem label={t("expiresAt")}>
              {visibleApiKey.expiresAt
                ? labels.dateTime(visibleApiKey.expiresAt)
                : t("notConfigured")}
            </DetailItem>
            <DetailItem label={t("rotationIntervalDays")}>
              {t("days", {
                count:
                  backoffice.credentialLifecycleSettings.rotationIntervalDays,
              })}
            </DetailItem>
            <DetailItem label={t("nextRotationAt")}>
              {visibleApiKey.nextRotationAt
                ? labels.dateTime(visibleApiKey.nextRotationAt)
                : t("notConfigured")}
            </DetailItem>
            <DetailItem label={t("usageSystems")}>
              {visibleApiKey.usageSystemNames.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {visibleApiKey.usageSystemNames.map((name) => (
                    <Badge key={name} variant="secondary">
                      {name}
                    </Badge>
                  ))}
                </span>
              ) : (
                t("usageSystemsEmpty")
              )}
            </DetailItem>
            {visibleApiKey.emergencyRevokedAt ? (
              <DetailItem
                label={t("emergencyRevokedAt")}
                className="sm:col-span-2"
              >
                {labels.dateTime(visibleApiKey.emergencyRevokedAt)} ·{" "}
                {visibleApiKey.emergencyRevokeReason}
              </DetailItem>
            ) : null}
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
            getRowHref={(row) =>
              canViewRequestDetail
                ? `/approval-documents/requests/${row.id}`
                : undefined
            }
            getRowLabel={(row) => `${row.title} ${common("details")}`}
            empty={t("requestHistoryEmpty")}
          />
        </CardContent>
      </Card>
    </div>
  )
}
