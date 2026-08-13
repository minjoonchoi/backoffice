"use client"

import { uiResourceKeys } from "@/config/menu-registry"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Bell,
  Check,
  ChevronRight,
  FileCheck2,
  KeyRound,
  ShieldCheck,
  Users,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import {
  resolveCredentialVisibility,
  type VisibleCredential,
} from "@/auth/credential-access"
import { useSessionAccess } from "@/auth/session-access-provider"
import { UiResourceLink } from "@/auth/ui-resource-link"
import { DataTable } from "@/components/patterns/data-table"
import { MetricCard } from "@/components/patterns/metric-card"
import { PageHeader } from "@/components/patterns/page-header"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { MenuKey } from "@/config/menu-registry"
import {
  accessPolicyResourceNames,
  resolveAccessPolicyResourceGroups,
  resolveAccessPolicyUiNamespaces,
  resolveAccessPolicyUiResources,
} from "@/features/access-policies/access-policy-resources"
import type {
  AccessPolicy,
  ApprovalDocument,
} from "@/features/access-policies/model"
import type { UserNotification } from "@/application/state/model"
import { useBackoffice } from "@/application/state/provider"
import {
  AccessPolicyEffectBadge,
  StatusBadge,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

type AccessGrantDocument = Extract<
  ApprovalDocument,
  { documentKind: "general"; type: "access-grant" }
>

type GrantedAccess = Readonly<{
  document: AccessGrantDocument
  policy: AccessPolicy
}>

export function HomeDashboard() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("home")
  const common = useTranslations("backoffice.common")
  const documentsT = useTranslations("backoffice.approvalDocuments")
  const apiKeysT = useTranslations("backoffice.apiKeys")
  const labels = useBackofficeLabels()
  const [summaryDialog, setSummaryDialog] = useState<
    "work" | "permissions" | "credentials" | "requests"
  >()
  const displayName = sessionAccess.currentUser?.nickname ?? t("operator")
  function requestTemplate(document: ApprovalDocument) {
    const template = backoffice.approvalLines.find(
      (item) => item.id === document.approvalLineId,
    )
    if (!template) {
      throw new Error(`Request template not found: ${document.approvalLineId}`)
    }
    return template
  }
  const accessibleMenuIds = new Set(sessionAccess.accessibleMenuIds)
  const canAccess = (menuId: MenuKey) => accessibleMenuIds.has(menuId)
  const pendingDocuments = backoffice.approvalDocuments
    .filter((document) => document.status === "submitted")
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
  const canAccessApprovals = canAccess("approvalDocuments")
  const canAccessApiKeys = canAccess("apiKeys")
  const notifications = sessionAccess.currentUser
    ? backoffice.notifications
        .filter(
          (notification) =>
            notification.userId === sessionAccess.currentUser?.id,
        )
        .toSorted((left, right) =>
          right.createdAt.localeCompare(left.createdAt),
        )
    : []
  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.readAt,
  ).length
  const relatedCredentials = useMemo(
    () =>
      resolveCredentialVisibility(
        backoffice,
        sessionAccess.currentUser?.id ?? null,
      ).credentials,
    [sessionAccess.currentUser?.id, backoffice],
  )
  const grantedAccess = useMemo(() => {
    if (!sessionAccess.currentUser) return []
    return backoffice.approvalDocuments
      .flatMap((document): GrantedAccess[] => {
        if (
          document.documentKind !== "general" ||
          document.type !== "access-grant" ||
          document.status !== "approved" ||
          document.requesterId !== sessionAccess.currentUser?.id
        ) {
          return []
        }
        const policy = backoffice.accessPolicies.find(
          (item) => item.id === document.accessPolicyId,
        )
        if (!policy) {
          throw new Error(
            `Granted access policy not found: ${document.accessPolicyId}`,
          )
        }
        return policy.status === "active" ? [{ document, policy }] : []
      })
      .toSorted((left, right) =>
        right.document.createdAt.localeCompare(left.document.createdAt),
      )
  }, [
    sessionAccess.currentUser,
    backoffice.accessPolicies,
    backoffice.approvalDocuments,
  ])
  const hasOperationalSummary =
    Boolean(sessionAccess.currentUser) || canAccessApprovals || canAccessApiKeys

  function requesterName(userId: string) {
    const requester = backoffice.users.find((user) => user.id === userId)
    if (!requester) throw new Error(`Approval requester not found: ${userId}`)
    return requester.nickname
  }

  function organizationName(organizationId: string) {
    const organization = backoffice.organizations.find(
      (item) => item.id === organizationId,
    )
    if (!organization) {
      throw new Error(`Organization not found: ${organizationId}`)
    }
    return organization.name
  }

  function serviceName(serviceId: string) {
    const service = backoffice.services.find((item) => item.id === serviceId)
    if (!service) throw new Error(`Service not found: ${serviceId}`)
    return service.name
  }

  function serviceOwnerName(serviceId: string) {
    const service = backoffice.services.find((item) => item.id === serviceId)
    if (!service) throw new Error(`Service not found: ${serviceId}`)
    return organizationName(service.ownerOrganizationId)
  }

  function notificationTarget(notification: UserNotification) {
    if (notification.targetType === "approval-document") {
      const document = backoffice.approvalDocuments.find(
        (item) => item.id === notification.targetId,
      )
      if (!document) {
        throw new Error(
          `Notification request not found: ${notification.targetId}`,
        )
      }
      return {
        title: document.title,
        href: `/approval-documents/requests/${document.id}`,
        resourceKey: uiResourceKeys.approvalDocuments.requestDetail.key,
        actionLabel: t("viewRequest"),
      }
    }
    const policy = backoffice.accessPolicies.find(
      (item) => item.id === notification.targetId,
    )
    if (!policy) {
      throw new Error(`Notification policy not found: ${notification.targetId}`)
    }
    return {
      title: policy.name,
      href: `/approval-documents/${policy.id}`,
      resourceKey: uiResourceKeys.approvalDocuments.detail.key,
      actionLabel: t("viewPolicy"),
    }
  }

  function requestStatus(document: ApprovalDocument) {
    return document.status === "draft"
      ? documentsT("draft")
      : document.status === "submitted"
        ? documentsT("submittedStatus")
        : documentsT("approvedStatus")
  }

  const permissionColumns: ColumnDef<GrantedAccess>[] = [
    {
      id: "policy",
      header: documentsT("policyName"),
      cell: ({ row }) => (
        <UiResourceLink
          resourceKey={uiResourceKeys.approvalDocuments.detail.key}
          href={`/approval-documents/${row.original.policy.id}`}
          className="text-primary hover:underline"
        >
          {row.original.policy.name}
        </UiResourceLink>
      ),
      size: 300,
    },
    {
      id: "services",
      header: documentsT("services"),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {resolveAccessPolicyResourceGroups(
            backoffice,
            row.original.policy,
          ).map(({ service }) => (
            <UiResourceLink
              resourceKey={uiResourceKeys.services.detail.key}
              key={service.id}
              href={`/services/${service.id}`}
              className="text-primary hover:underline"
            >
              {service.name}
            </UiResourceLink>
          ))}
          {resolveAccessPolicyUiResources(backoffice, row.original.policy).map(
            ({ namespace, resource }) => (
              <span key={resource.id}>
                {namespace.name} / {resource.name}
              </span>
            ),
          )}
          {resolveAccessPolicyUiNamespaces(backoffice, row.original.policy).map(
            (namespace) => (
              <span key={namespace.id}>{namespace.name}</span>
            ),
          )}
        </div>
      ),
      size: 240,
    },
    {
      id: "effect",
      header: documentsT("effect"),
      cell: ({ row }) => (
        <AccessPolicyEffectBadge effect={row.original.policy.effect} />
      ),
      size: 120,
    },
    {
      id: "resources",
      header: documentsT("resources"),
      cell: ({ row }) =>
        documentsT("resourceCount", {
          count: row.original.policy.resources.length,
        }),
      size: 140,
    },
    {
      id: "request",
      header: t("requestTitle"),
      cell: ({ row }) => (
        <UiResourceLink
          resourceKey={uiResourceKeys.approvalDocuments.list.key}
          href="/approval-documents"
          className="font-medium text-primary hover:underline"
        >
          {row.original.document.title}
        </UiResourceLink>
      ),
      size: 280,
    },
    {
      id: "requestedAt",
      header: t("requestedAt"),
      cell: ({ row }) => labels.dateTime(row.original.document.createdAt),
      size: 180,
    },
  ]

  const credentialColumns: ColumnDef<VisibleCredential>[] = [
    {
      id: "name",
      header: apiKeysT("keyName"),
      cell: ({ row }) => row.original.credential.name,
      size: 220,
    },
    {
      id: "service",
      header: apiKeysT("service"),
      cell: ({ row }) => (
        <UiResourceLink
          resourceKey={uiResourceKeys.services.detail.key}
          href={`/services/${row.original.credential.serviceId}`}
          className="text-primary hover:underline"
        >
          {serviceName(row.original.credential.serviceId)}
        </UiResourceLink>
      ),
      size: 180,
    },
    {
      id: "ownerOrganization",
      header: t("ownerOrganization"),
      cell: ({ row }) => {
        const service = backoffice.services.find(
          (item) => item.id === row.original.credential.serviceId,
        )
        if (!service) {
          throw new Error(
            `Service not found: ${row.original.credential.serviceId}`,
          )
        }
        return (
          <UiResourceLink
            resourceKey={uiResourceKeys.organizations.detail.key}
            href={`/organizations/${service.ownerOrganizationId}`}
            className="text-primary hover:underline"
          >
            {organizationName(service.ownerOrganizationId)}
          </UiResourceLink>
        )
      },
      size: 180,
    },
    {
      id: "scope",
      header: t("credentialRelationship"),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1.5">
          {row.original.scopes.map((scope) => (
            <Badge
              key={scope}
              variant={scope === "requester" ? "info" : "secondary"}
            >
              {t(`credentialScopes.${scope}`)}
            </Badge>
          ))}
        </div>
      ),
      size: 220,
    },
    {
      id: "status",
      header: common("status"),
      cell: ({ row }) => (
        <StatusBadge status={row.original.credential.status} />
      ),
      size: 100,
    },
    {
      id: "createdAt",
      header: apiKeysT("createdAt"),
      cell: ({ row }) => labels.dateTime(row.original.credential.createdAt),
      size: 180,
    },
  ]

  const requestColumns: ColumnDef<ApprovalDocument>[] = [
    {
      accessorKey: "title",
      header: t("requestTitle"),
      cell: ({ row }) => (
        <UiResourceLink
          resourceKey={
            row.original.documentKind !== "general"
              ? uiResourceKeys.apiKeys.list.key
              : uiResourceKeys.approvalDocuments.list.key
          }
          href={
            row.original.documentKind !== "general"
              ? "/api-keys"
              : "/approval-documents"
          }
          className="font-medium text-primary hover:underline"
        >
          {row.original.title}
        </UiResourceLink>
      ),
      size: 300,
    },
    {
      id: "category",
      header: t("requestCategory"),
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.documentKind !== "general" ? "info" : "secondary"
          }
        >
          {t(`requestCategories.${requestTemplate(row.original).category}`)}
        </Badge>
      ),
      size: 180,
    },
    {
      accessorKey: "type",
      header: t("requestType"),
      cell: ({ row }) => labels.approvalType(row.original.type),
      size: 180,
    },
    {
      accessorKey: "requesterId",
      header: documentsT("requester"),
      cell: ({ row }) => (
        <UiResourceLink
          resourceKey={uiResourceKeys.users.detail.key}
          href={`/users/${row.original.requesterId}`}
          className="text-primary hover:underline"
        >
          {requesterName(row.original.requesterId)}
        </UiResourceLink>
      ),
      size: 140,
    },
    {
      accessorKey: "organizationId",
      header: documentsT("requestOrganization"),
      cell: ({ row }) => (
        <UiResourceLink
          resourceKey={uiResourceKeys.organizations.detail.key}
          href={`/organizations/${row.original.organizationId}`}
          className="text-primary hover:underline"
        >
          {organizationName(row.original.organizationId)}
        </UiResourceLink>
      ),
      size: 180,
    },
    {
      accessorKey: "status",
      header: common("status"),
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === "approved"
              ? "success"
              : row.original.status === "submitted"
                ? "warning"
                : "secondary"
          }
        >
          {requestStatus(row.original)}
        </Badge>
      ),
      size: 120,
    },
    {
      accessorKey: "createdAt",
      header: t("requestedAt"),
      cell: ({ row }) => labels.dateTime(row.original.createdAt),
      size: 180,
    },
  ]

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description", { name: displayName })}
        actions={
          sessionAccess.currentUser ? (
            <Button
              variant="outline"
              onClick={() => {
                setSummaryDialog("work")
              }}
            >
              <Users aria-hidden="true" />
              {t("myWorkTitle")}
            </Button>
          ) : null
        }
      />

      {hasOperationalSummary ? (
        <section aria-labelledby="home-summary-title" className="grid gap-3">
          <div>
            <h2 id="home-summary-title" className="text-base font-medium">
              {t("summaryTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("summaryDescription")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sessionAccess.currentUser ? (
              <MetricCard
                icon={ShieldCheck}
                title={t("effectivePermissions")}
                value={grantedAccess.length}
                description={t("selectMetricForDetails")}
                actionLabel={t("openPermissions", {
                  count: grantedAccess.length,
                })}
                onClick={() => {
                  setSummaryDialog("permissions")
                }}
              />
            ) : null}
            {canAccessApprovals ? (
              <MetricCard
                icon={FileCheck2}
                title={t("pendingApprovals")}
                value={pendingDocuments.length}
                description={t("selectMetricForDetails")}
                actionLabel={t("openPendingRequests", {
                  count: pendingDocuments.length,
                })}
                onClick={() => {
                  setSummaryDialog("requests")
                }}
              />
            ) : null}
            {canAccessApiKeys ? (
              sessionAccess.currentUser ? (
                <MetricCard
                  icon={KeyRound}
                  title={t("managedCredentials")}
                  value={relatedCredentials.length}
                  description={t("selectMetricForDetails")}
                  actionLabel={t("openCredentials", {
                    count: relatedCredentials.length,
                  })}
                  onClick={() => {
                    setSummaryDialog("credentials")
                  }}
                />
              ) : (
                <MetricCard
                  icon={KeyRound}
                  title={t("activeApiKeys")}
                  value={
                    backoffice.apiKeys.filter(
                      (apiKey) => apiKey.status === "active",
                    ).length
                  }
                />
              )
            ) : null}
          </div>
        </section>
      ) : null}

      {sessionAccess.currentUser ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="grid gap-1">
              <CardTitle className="flex items-center gap-2">
                <Bell className="size-4" aria-hidden />
                {t("notificationsTitle")}
              </CardTitle>
              <CardDescription>{t("notificationsDescription")}</CardDescription>
            </div>
            <Badge variant={unreadNotificationCount ? "info" : "secondary"}>
              {t("unreadNotificationCount", {
                count: unreadNotificationCount,
              })}
            </Badge>
          </CardHeader>
          <CardContent>
            {notifications.length ? (
              <ul className="grid gap-2">
                {notifications.map((notification) => {
                  const target = notificationTarget(notification)
                  return (
                    <li
                      key={notification.id}
                      className={`grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-center ${
                        notification.readAt ? "bg-surface-subtle" : "bg-surface"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            {t(`notificationEvents.${notification.event}`)}
                          </p>
                          <Badge
                            variant={notification.readAt ? "secondary" : "info"}
                          >
                            {t(notification.readAt ? "read" : "unread")}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {target.title}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                        <time
                          dateTime={notification.createdAt}
                          className="shrink-0 text-xs text-muted-foreground"
                        >
                          {labels.dateTime(notification.createdAt)}
                        </time>
                        {!notification.readAt ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (sessionAccess.currentUser) {
                                void backoffice.markNotificationRead(
                                  notification.id,
                                  sessionAccess.currentUser.id,
                                )
                              }
                            }}
                          >
                            <Check />
                            {t("markAsRead")}
                          </Button>
                        ) : null}
                        <UiResourceLink
                          resourceKey={target.resourceKey}
                          href={target.href}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                          onClick={() => {
                            if (
                              !notification.readAt &&
                              sessionAccess.currentUser
                            ) {
                              void backoffice.markNotificationRead(
                                notification.id,
                                sessionAccess.currentUser.id,
                              )
                            }
                          }}
                        >
                          {target.actionLabel}
                          <ChevronRight />
                        </UiResourceLink>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center">
                <p className="font-medium">{t("notificationsEmpty")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("notificationsEmptyDescription")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={summaryDialog === "requests"}
        onOpenChange={(open) => {
          if (!open) setSummaryDialog(undefined)
        }}
      >
        <DialogContent className="max-h-[min(90svh,56rem)] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("pendingRequestsTitle")}</DialogTitle>
            <DialogDescription>
              {t("pendingRequestsDescription")}
            </DialogDescription>
          </DialogHeader>
          <DataTable
            caption={t("pendingRequestsCaption")}
            columns={requestColumns}
            data={pendingDocuments}
            getRowId={(row) => row.id}
            empty={t("pendingRequestsEmpty")}
            filterLabel={common("search")}
            noResults={common("noResults")}
            filters={[
              {
                id: "request-title",
                label: t("requestTitle"),
                getValue: (row) => row.title,
              },
              {
                id: "request-category",
                label: t("requestCategory"),
                getValue: (row) =>
                  t(`requestCategories.${requestTemplate(row).category}`),
              },
              {
                id: "request-type",
                label: t("requestType"),
                getValue: (row) => labels.approvalType(row.type),
              },
              {
                id: "requester",
                label: documentsT("requester"),
                getValue: (row) => requesterName(row.requesterId),
              },
              {
                id: "request-status",
                label: common("status"),
                getValue: requestStatus,
              },
            ]}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={summaryDialog === "work"}
        onOpenChange={(open) => {
          if (!open) setSummaryDialog(undefined)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("myWorkTitle")}</DialogTitle>
            <DialogDescription>{t("myWorkDescription")}</DialogDescription>
          </DialogHeader>
          <dl className="grid gap-4">
            <div className="grid gap-1.5">
              <dt className="text-xs font-medium text-muted-foreground">
                {t("myOrganizations")}
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {sessionAccess.organizationNames.length ? (
                  sessionAccess.organizationNames.map((name) => (
                    <Badge key={name} variant="secondary">
                      {name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {t("none")}
                  </span>
                )}
              </dd>
            </div>
            <div className="grid gap-1.5">
              <dt className="text-xs font-medium text-muted-foreground">
                {t("myRoles")}
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {sessionAccess.effectiveRoles.length ? (
                  sessionAccess.effectiveRoles.map((role) => (
                    <Badge key={role.id} variant="outline">
                      {role.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {t("none")}
                  </span>
                )}
              </dd>
            </div>
            <div className="grid gap-1.5">
              <dt className="text-xs font-medium text-muted-foreground">
                {t("myGroups")}
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {sessionAccess.groupNames.length ? (
                  sessionAccess.groupNames.map((name) => (
                    <Badge key={name} variant="warning">
                      {name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {t("none")}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </DialogContent>
      </Dialog>

      <Dialog
        open={summaryDialog === "permissions"}
        onOpenChange={(open) => {
          if (!open) setSummaryDialog(undefined)
        }}
      >
        <DialogContent className="max-h-[min(90svh,56rem)] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("permissionsTitle")}</DialogTitle>
            <DialogDescription>{t("permissionsDescription")}</DialogDescription>
          </DialogHeader>
          <DataTable
            caption={t("permissionsCaption")}
            columns={permissionColumns}
            data={grantedAccess}
            getRowId={(row) => row.document.id}
            empty={t("permissionsEmpty")}
            filterLabel={common("search")}
            noResults={common("noResults")}
            filters={[
              {
                id: "permission-policy",
                label: documentsT("policyName"),
                getValue: (row) => row.policy.name,
              },
              {
                id: "permission-services",
                label: documentsT("services"),
                getValue: (row) =>
                  accessPolicyResourceNames(backoffice, row.policy),
              },
              {
                id: "permission-effect",
                label: documentsT("effect"),
                getValue: (row) => documentsT(row.policy.effect),
              },
              {
                id: "permission-request",
                label: t("requestTitle"),
                getValue: (row) => row.document.title,
              },
            ]}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={summaryDialog === "credentials"}
        onOpenChange={(open) => {
          if (!open) setSummaryDialog(undefined)
        }}
      >
        <DialogContent className="max-h-[min(90svh,56rem)] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("managedCredentialsTitle")}</DialogTitle>
            <DialogDescription>
              {t("managedCredentialsDescription")}
            </DialogDescription>
          </DialogHeader>
          <DataTable
            caption={t("managedCredentialsCaption")}
            columns={credentialColumns}
            data={relatedCredentials}
            getRowId={(row) => row.credential.id}
            empty={t("managedCredentialsEmpty")}
            filterLabel={common("search")}
            noResults={common("noResults")}
            filters={[
              {
                id: "credential-name",
                label: apiKeysT("keyName"),
                getValue: (row) => row.credential.name,
              },
              {
                id: "credential-service",
                label: apiKeysT("service"),
                getValue: (row) => serviceName(row.credential.serviceId),
              },
              {
                id: "credential-owner",
                label: t("ownerOrganization"),
                getValue: (row) => serviceOwnerName(row.credential.serviceId),
              },
              {
                id: "credential-relationship",
                label: t("credentialRelationship"),
                getValue: (row) =>
                  row.scopes
                    .map((scope) => t(`credentialScopes.${scope}`))
                    .join(" "),
              },
            ]}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
