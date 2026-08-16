"use client"

import { approvalAssigneeModeValues } from "@/features/request-templates/model"
import { accessPolicyAssignmentTargets } from "@/features/access-policies/model"
import type { ColumnDef } from "@tanstack/react-table"
import { Users } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import {
  resolveCredentialVisibility,
  type VisibleCredential,
} from "@/auth/credential-access"
import { useSessionAccess } from "@/auth/session-access-provider"
import { UiResourceLink } from "@/auth/ui-resource-link"
import { useBackoffice } from "@/application/state/provider"
import {
  AccessPolicyEffectBadge,
  StatusBadge,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"
import { DataTable } from "@/components/patterns/data-table"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { uiResourceKeys } from "@/config/menu-registry"
import {
  resolveEffectiveAccessPolicyGrants,
  type EffectiveAccessPolicyGrant,
  type EffectiveAccessPolicyPath,
} from "@/features/access-policies/access-policy-assignment"

export function HomeDashboard() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("home")
  const common = useTranslations("backoffice.common")
  const usersT = useTranslations("backoffice.users")
  const apiKeysT = useTranslations("backoffice.apiKeys")
  const labels = useBackofficeLabels()
  const [workDialogOpen, setWorkDialogOpen] = useState(false)
  const displayName = sessionAccess.currentUser?.nickname ?? t("operator")
  const currentUser = sessionAccess.currentUser
  const canAccessCredentials = sessionAccess.accessibleMenuIds.includes(
    uiResourceKeys.apiKeys.key,
  )
  const ownedPolicies = useMemo(
    () =>
      currentUser
        ? resolveEffectiveAccessPolicyGrants(backoffice, currentUser.id)
        : [],
    [backoffice, currentUser],
  )
  const relatedCredentials = useMemo(
    () =>
      resolveCredentialVisibility(backoffice, currentUser?.id ?? null)
        .credentials,
    [backoffice, currentUser?.id],
  )

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

  function policyPathLabel(path: EffectiveAccessPolicyPath) {
    if (path.type === accessPolicyAssignmentTargets.user)
      return usersT("policyPathDirectUser")
    if (path.type === accessPolicyAssignmentTargets.organization) {
      return usersT("policyPathOrganization", {
        name: organizationName(path.targetId),
      })
    }
    const role = backoffice.roles.find((item) => item.id === path.targetId)
    if (!role) throw new Error(`Policy role not found: ${path.targetId}`)
    return path.viaOrganizationId
      ? usersT("policyPathOrganizationRole", {
          organization: organizationName(path.viaOrganizationId),
          role: role.name,
        })
      : usersT("policyPathRole", { name: role.name })
  }

  const policyColumns: ColumnDef<EffectiveAccessPolicyGrant>[] = [
    {
      id: "policy",
      header: t("policyName"),
      cell: ({ row }) => (
        <UiResourceLink
          resourceKey={uiResourceKeys.approvalDocuments.detail.key}
          href={`/approval-documents/${row.original.policy.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.policy.name}
        </UiResourceLink>
      ),
      size: 280,
    },
    {
      id: "effect",
      header: t("policyEffect"),
      cell: ({ row }) => (
        <AccessPolicyEffectBadge effect={row.original.policy.effect} />
      ),
      size: 100,
    },
    {
      id: "paths",
      header: t("policyGrantPaths"),
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-wrap gap-1">
          {row.original.paths.map((path, index) => (
            <Badge
              key={`${path.type}-${path.targetId}-${String(index)}`}
              variant="outline"
            >
              {policyPathLabel(path)}
            </Badge>
          ))}
        </div>
      ),
      size: 360,
    },
  ]

  const credentialColumns: ColumnDef<VisibleCredential>[] = [
    {
      id: "name",
      header: apiKeysT("keyName"),
      cell: ({ row }) => (
        <UiResourceLink
          resourceKey={uiResourceKeys.apiKeys.detail.key}
          href={`/credentials/${row.original.credential.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.credential.name}
        </UiResourceLink>
      ),
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
              variant={
                scope === approvalAssigneeModeValues.requester
                  ? "info"
                  : "secondary"
              }
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

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description", { name: displayName })}
        actions={
          currentUser ? (
            <Button
              variant="outline"
              onClick={() => {
                setWorkDialogOpen(true)
              }}
            >
              <Users aria-hidden="true" />
              {t("myWorkTitle")}
            </Button>
          ) : null
        }
      />

      {currentUser ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("ownedPoliciesTitle")}</CardTitle>
            <CardDescription>{t("ownedPoliciesDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              caption={t("ownedPoliciesCaption")}
              columns={policyColumns}
              data={[...ownedPolicies]}
              getRowId={(row) => row.policy.id}
              getRowHref={(row) => `/approval-documents/${row.policy.id}`}
              getRowLabel={(row) => `${row.policy.name} ${common("details")}`}
              empty={t("ownedPoliciesEmpty")}
              filterLabel={common("search")}
              noResults={common("noResults")}
              filters={[
                {
                  id: "policy-name",
                  label: t("policyName"),
                  getValue: (row) => row.policy.name,
                },
                {
                  id: "policy-effect",
                  label: t("policyEffect"),
                  getValue: (row) => row.policy.effect,
                },
              ]}
            />
          </CardContent>
        </Card>
      ) : null}

      {currentUser && canAccessCredentials ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("managedCredentialsTitle")}</CardTitle>
            <CardDescription>
              {t("managedCredentialsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              caption={t("managedCredentialsCaption")}
              columns={credentialColumns}
              data={relatedCredentials}
              getRowId={(row) => row.credential.id}
              getRowHref={(row) => `/credentials/${row.credential.id}`}
              getRowLabel={(row) =>
                `${row.credential.name} ${common("details")}`
              }
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
              ]}
            />
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={workDialogOpen} onOpenChange={setWorkDialogOpen}>
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
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  )
}
