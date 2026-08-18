"use client"

import { accessPolicyAssignmentTargets } from "@/features/access-policies/model"
import { employmentStatusValues } from "@/features/iam/model"
import { uiResourceKeys } from "@/config/menu-registry"
import type { ColumnDef } from "@tanstack/react-table"
import { Building2, Pencil, Users } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useMemo } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { UiResourceLink } from "@/auth/ui-resource-link"
import { resolveVisibleDirectoryUsers } from "@/auth/user-directory-access"
import { EmptyState } from "@/components/patterns/content-state"
import { DataTable } from "@/components/patterns/data-table"
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
import { isSystemManagedRole } from "@/domain/system-references"
import { type BackofficeUser, type Organization } from "@/features/iam/model"
import { AssignmentDialog } from "@/application/ui/assignment-dialog"
import { AccessPolicyAssignmentCard } from "@/application/ui/access-policy-assignment-card"
import { RelationshipRemoveAction } from "@/application/ui/relationship-remove-action"
import { useBackoffice } from "@/application/state/provider"
import {
  AccessPolicyEffectBadge,
  EmploymentStatusBadge,
  EmploymentStatusSelect,
  ServiceTypeBadge,
  StatusBadge,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"
import {
  resolveEffectiveAccessPolicyGrants,
  type EffectiveAccessPolicyGrant,
  type EffectiveAccessPolicyPath,
} from "@/features/access-policies/access-policy-assignment"
import type { ApiKey } from "@/features/credentials/model"
import { resolveOrganizationMembershipRemovalImpact } from "@/features/iam/relationship-impact"
import type { ManagedService } from "@/features/service-catalog/model"

function AddOrganizationUsersDialog({
  organization,
}: {
  organization: Organization
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.organizations")
  const candidates = backoffice.users.filter(
    (user) => !user.organizationIds.includes(organization.id),
  )

  return (
    <AssignmentDialog
      triggerLabel={t("addMembers")}
      title={t("addMembers")}
      description={t("addMembersDescription")}
      searchLabel={t("memberSearch")}
      options={candidates.map((user) => ({
        id: user.id,
        title: user.nickname,
        description: user.email,
      }))}
      successMessage={t("membersAdded")}
      onAssign={(ids) =>
        backoffice.addUsersToOrganization(
          organization.id,
          ids,
          sessionAccess.currentUser?.id ?? "",
        )
      }
    />
  )
}

function AddOrganizationRolesDialog({
  organization,
}: {
  organization: Organization
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.organizations")
  const candidates = backoffice.roles.filter(
    (role) => !role.organizationIds.includes(organization.id),
  )

  return (
    <AssignmentDialog
      triggerLabel={t("addRoles")}
      title={t("addRoles")}
      description={t("addRolesDescription")}
      searchLabel={t("roleSearch")}
      options={candidates.map((role) => ({
        id: role.id,
        title: role.name,
        description: role.description,
        searchText: `${role.name} ${role.description}`,
      }))}
      successMessage={t("rolesAdded")}
      onAssign={(ids) =>
        backoffice.assignOrganizationsToRoles(
          [organization.id],
          ids,
          sessionAccess.currentUser?.id ?? "",
        )
      }
    />
  )
}

function AddUserOrganizationsDialog({ user }: { user: BackofficeUser }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.users")
  const candidates = backoffice.organizations.filter(
    (organization) => !user.organizationIds.includes(organization.id),
  )

  return (
    <AssignmentDialog
      triggerLabel={t("addOrganizations")}
      title={t("addOrganizations")}
      description={t("addOrganizationsDescription")}
      searchLabel={t("organizationSearch")}
      options={candidates.map((organization) => ({
        id: organization.id,
        title: organization.name,
      }))}
      successMessage={t("organizationsAdded")}
      onAssign={(ids) =>
        backoffice.addOrganizationsToUser(
          user.id,
          ids,
          sessionAccess.currentUser?.id ?? "",
        )
      }
    />
  )
}

function AddUserRolesDialog({ user }: { user: BackofficeUser }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.users")
  const candidates = backoffice.roles.filter(
    (role) => !role.userIds.includes(user.id),
  )

  return (
    <AssignmentDialog
      triggerLabel={t("addRoles")}
      title={t("addRoles")}
      description={t("addRolesDescription")}
      searchLabel={t("roleSearch")}
      options={candidates.map((role) => ({
        id: role.id,
        title: role.name,
        description: role.description,
        searchText: `${role.name} ${role.description}`,
      }))}
      successMessage={t("rolesAdded")}
      onAssign={(ids) =>
        backoffice.assignUsersToRoles(
          [user.id],
          ids,
          sessionAccess.currentUser?.id ?? "",
        )
      }
    />
  )
}

export function OrganizationsPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const canCreate = sessionAccess.canAccessUiResource(
    uiResourceKeys.organizations.list.actions.createOrganization,
  )
  const canViewDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.organizations.detail.key,
  )
  const t = useTranslations("backoffice.organizations")
  const common = useTranslations("backoffice.common")
  const labels = useBackofficeLabels()
  const columns = useMemo<ColumnDef<Organization>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("organizationName"),
      },
      {
        id: "leader",
        header: t("leader"),
        cell: ({ row }) => {
          const leader = backoffice.users.find(
            (user) => user.id === row.original.leaderUserId,
          )
          if (!leader) {
            throw new Error(
              `Organization leader not found: ${row.original.leaderUserId}`,
            )
          }
          return (
            <UiResourceLink
              resourceKey={uiResourceKeys.users.detail.key}
              className="text-primary hover:underline"
              href={`/users/${leader.id}`}
            >
              {leader.nickname}
            </UiResourceLink>
          )
        },
      },
      {
        id: "parent",
        header: t("parent"),
        cell: ({ row }) => {
          const parent = backoffice.organizations.find(
            (item) => item.id === row.original.parentId,
          )
          return parent ? (
            <UiResourceLink
              resourceKey={uiResourceKeys.organizations.detail.key}
              className="text-primary hover:underline"
              href={`/organizations/${parent.id}`}
            >
              {parent.name}
            </UiResourceLink>
          ) : (
            t("noParent")
          )
        },
      },
      {
        id: "members",
        header: t("memberCount"),
        cell: ({ row }) =>
          backoffice.users.filter((user) =>
            user.organizationIds.includes(row.original.id),
          ).length,
      },
      {
        accessorKey: "createdAt",
        header: common("createdAt"),
        cell: ({ row }) => labels.dateTime(row.original.createdAt),
      },
    ],
    [common, labels, t, backoffice.organizations, backoffice.users],
  )

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          canCreate ? (
            <Button
              nativeButton={false}
              render={<Link href="/organizations/new" />}
            >
              {t("add")}
            </Button>
          ) : undefined
        }
      />
      {canCreate &&
      backoffice.users.every(
        (user) => user.employmentStatus !== employmentStatusValues.employed,
      ) ? (
        <p className="rounded-lg border border-warning-foreground/30 bg-warning p-3 text-sm text-warning-foreground">
          {t("userRequired")}{" "}
          <UiResourceLink
            resourceKey={uiResourceKeys.users.create.key}
            href="/users/new"
            className="font-medium underline"
          >
            {t("createUser")}
          </UiResourceLink>
        </p>
      ) : null}
      <div className="grid gap-3 sm:max-w-sm">
        <MetricCard
          icon={Building2}
          title={t("total")}
          value={backoffice.organizations.length}
        />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        data={backoffice.organizations}
        getRowId={(row) => row.id}
        getRowHref={(row) =>
          canViewDetail ? `/organizations/${row.id}` : undefined
        }
        getRowLabel={(row) => `${row.name} ${common("details")}`}
        empty={t("empty")}
        filterLabel={common("search")}
        noResults={common("noResults")}
        filters={[
          {
            id: "organization-name",
            label: t("organizationName"),
            getValue: (row) => row.name,
          },
          {
            id: "leader",
            label: t("leader"),
            getValue: (row) =>
              backoffice.users.find((user) => user.id === row.leaderUserId)
                ?.nickname ?? "",
          },
          {
            id: "parent",
            label: t("parent"),
            getValue: (row) =>
              backoffice.organizations.find((item) => item.id === row.parentId)
                ?.name ?? t("noParent"),
          },
        ]}
      />
      <p className="text-xs text-muted-foreground">{common("sessionNotice")}</p>
    </div>
  )
}

export function UsersPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.users")
  const common = useTranslations("backoffice.common")
  const labels = useBackofficeLabels()
  const canViewDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.users.detail.key,
  )
  const visibleUsers = useMemo(
    () =>
      resolveVisibleDirectoryUsers(
        backoffice.users,
        sessionAccess.canAccessUiResource(
          uiResourceKeys.users.list.actions.createUser,
        ),
      ),
    [sessionAccess, backoffice.users],
  )
  const columns = useMemo<ColumnDef<BackofficeUser>[]>(
    () => [
      {
        accessorKey: "nickname",
        header: t("nickname"),
      },
      { accessorKey: "email", header: t("email") },
      {
        id: "organizations",
        header: t("organizations"),
        cell: ({ row }) => {
          const organizations = row.original.organizationIds.map((id) => {
            const organization = backoffice.organizations.find(
              (item) => item.id === id,
            )
            if (!organization) {
              throw new Error(`User organization not found: ${id}`)
            }
            return organization
          })
          return organizations.length > 0 ? (
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              {organizations.map((organization) => (
                <UiResourceLink
                  resourceKey={uiResourceKeys.organizations.detail.key}
                  key={organization.id}
                  className="text-primary hover:underline"
                  href={`/organizations/${organization.id}`}
                >
                  {organization.name}
                </UiResourceLink>
              ))}
            </div>
          ) : (
            t("unassigned")
          )
        },
      },
      {
        id: "employmentStatus",
        header: t("employmentStatus"),
        cell: ({ row }) => (
          <EmploymentStatusBadge status={row.original.employmentStatus} />
        ),
      },
      {
        accessorKey: "createdAt",
        header: common("createdAt"),
        cell: ({ row }) => labels.dateTime(row.original.createdAt),
      },
    ],
    [common, labels, t, backoffice],
  )
  const organizations = new Set(
    visibleUsers.flatMap((item) => item.organizationIds),
  ).size

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          sessionAccess.canAccessUiResource(
            uiResourceKeys.users.list.actions.createUser,
          ) ? (
            <Button nativeButton={false} render={<Link href="/users/new" />}>
              {t("add")}
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={Users}
          title={t("total")}
          value={visibleUsers.length}
        />
        <MetricCard
          icon={Users}
          title={t("employedCount")}
          value={
            visibleUsers.filter(
              (item) =>
                item.employmentStatus === employmentStatusValues.employed,
            ).length
          }
        />
        <MetricCard
          icon={Building2}
          title={t("organizationCount")}
          value={organizations}
        />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        data={visibleUsers}
        getRowId={(row) => row.id}
        getRowHref={(row) => (canViewDetail ? `/users/${row.id}` : undefined)}
        getRowLabel={(row) => `${row.nickname} ${common("details")}`}
        empty={t("empty")}
        filterLabel={common("search")}
        noResults={common("noResults")}
        filters={[
          {
            id: "nickname",
            label: t("nickname"),
            getValue: (row) => row.nickname,
          },
          { id: "email", label: t("email"), getValue: (row) => row.email },
          {
            id: "organizations",
            label: t("organizations"),
            getValue: (row) =>
              row.organizationIds
                .map(
                  (id) =>
                    backoffice.organizations.find((item) => item.id === id)
                      ?.name ?? "",
                )
                .join(" "),
          },
          {
            id: "employment-status",
            label: t("employmentStatus"),
            getValue: (row) => labels.employmentStatus(row.employmentStatus),
          },
        ]}
      />
      <p className="text-xs text-muted-foreground">{common("sessionNotice")}</p>
    </div>
  )
}

export function OrganizationDetailPage({
  organizationId,
}: {
  organizationId: string
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const canUpdate = sessionAccess.canAccessUiResource(
    uiResourceKeys.organizations.detail.actions.updateOrganization,
  )
  const canManageMembers = sessionAccess.canAccessUiResource(
    uiResourceKeys.organizations.detail.actions.addOrganizationUser,
  )
  const canAssignRoles = sessionAccess.canAccessUiResource(
    uiResourceKeys.organizations.detail.actions.assignOrganizationRole,
  )
  const canViewUserDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.users.detail.key,
  )
  const canViewOrganizationDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.organizations.detail.key,
  )
  const t = useTranslations("backoffice.organizations")
  const usersT = useTranslations("backoffice.users")
  const common = useTranslations("backoffice.common")
  const labels = useBackofficeLabels()
  const organization = backoffice.organizations.find(
    (item) => item.id === organizationId,
  )
  if (!organization)
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          sessionAccess.canAccessUiResource(
            uiResourceKeys.organizations.list.key,
          ) ? (
            <Button render={<Link href="/organizations" />}>
              {common("backToList")}
            </Button>
          ) : undefined
        }
      />
    )

  const visibleUsers = resolveVisibleDirectoryUsers(
    backoffice.users,
    sessionAccess.canAccessUiResource(
      uiResourceKeys.users.list.actions.createUser,
    ),
  )
  const members = visibleUsers.filter((user) =>
    user.organizationIds.includes(organization.id),
  )
  const children = backoffice.organizations.filter(
    (item) => item.parentId === organization.id,
  )
  const roles = backoffice.roles.filter((role) =>
    role.organizationIds.includes(organization.id),
  )
  const ownedServices = backoffice.services.filter(
    (service) => service.ownerOrganizationId === organization.id,
  )
  const ownedServiceIds = new Set(ownedServices.map((service) => service.id))
  const ownedCredentials = backoffice.apiKeys.filter((credential) =>
    ownedServiceIds.has(credential.serviceId),
  )
  const memberColumns: ColumnDef<BackofficeUser>[] = [
    {
      accessorKey: "nickname",
      header: usersT("nickname"),
      cell: ({ row }) => (
        <UiResourceLink
          resourceKey={uiResourceKeys.users.detail.key}
          className="text-primary hover:underline"
          href={`/users/${row.original.id}`}
        >
          {row.original.nickname}
        </UiResourceLink>
      ),
    },
    { accessorKey: "email", header: usersT("email") },
    {
      id: "employmentStatus",
      header: usersT("employmentStatus"),
      cell: ({ row }) => (
        <EmploymentStatusBadge status={row.original.employmentStatus} />
      ),
    },
    ...(canManageMembers
      ? [
          {
            id: "actions",
            header: common("actions"),
            size: 96,
            cell: ({ row }) =>
              (() => {
                const impact = resolveOrganizationMembershipRemovalImpact(
                  backoffice,
                  row.original.id,
                  organization.id,
                )
                return (
                  <RelationshipRemoveAction
                    subjectName={organization.name}
                    targetName={row.original.nickname}
                    impactDescription={t("membershipRemovalImpact", {
                      roles: impact.lostRoleIds.length,
                      policies: impact.lostPolicyIds.length,
                      credentials: impact.lostCredentialIds.length,
                      requests: impact.affectedRequestIds.length,
                    })}
                    confirmDisabled={impact.blocked}
                    onRemove={() =>
                      backoffice.removeUsersFromOrganizations(
                        [row.original.id],
                        [organization.id],
                        sessionAccess.currentUser?.id ?? "",
                      )
                    }
                  />
                )
              })(),
          } satisfies ColumnDef<BackofficeUser>,
        ]
      : []),
  ]
  const childColumns: ColumnDef<Organization>[] = [
    {
      accessorKey: "name",
      header: t("organizationName"),
      cell: ({ row }) => (
        <UiResourceLink
          resourceKey={uiResourceKeys.organizations.detail.key}
          className="text-primary hover:underline"
          href={`/organizations/${row.original.id}`}
        >
          {row.original.name}
        </UiResourceLink>
      ),
    },
    {
      id: "leader",
      header: t("leader"),
      cell: ({ row }) => {
        const leader = backoffice.users.find(
          (user) => user.id === row.original.leaderUserId,
        )
        if (!leader) {
          throw new Error(
            `Organization leader not found: ${row.original.leaderUserId}`,
          )
        }
        return (
          <UiResourceLink
            resourceKey={uiResourceKeys.users.detail.key}
            className="text-primary hover:underline"
            href={`/users/${leader.id}`}
          >
            {leader.nickname}
          </UiResourceLink>
        )
      },
    },
  ]
  const serviceColumns: ColumnDef<ManagedService>[] = [
    {
      accessorKey: "name",
      header: t("serviceName"),
      cell: ({ row }) => (
        <UiResourceLink
          resourceKey={uiResourceKeys.services.detail.key}
          href={`/services/${row.original.id}`}
        >
          {row.original.name}
        </UiResourceLink>
      ),
    },
    {
      accessorKey: "type",
      header: t("serviceType"),
      cell: ({ row }) => <ServiceTypeBadge type={row.original.type} />,
    },
    {
      accessorKey: "status",
      header: common("status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]
  const credentialColumns: ColumnDef<ApiKey>[] = [
    { accessorKey: "name", header: t("credentialName") },
    {
      id: "service",
      header: t("serviceName"),
      cell: ({ row }) => {
        const service = backoffice.services.find(
          (candidate) => candidate.id === row.original.serviceId,
        )
        if (!service)
          throw new Error(`Credential service not found: ${row.original.id}`)
        return (
          <UiResourceLink
            resourceKey={uiResourceKeys.services.detail.key}
            href={`/services/${service.id}`}
          >
            {service.name}
          </UiResourceLink>
        )
      },
    },
    {
      accessorKey: "status",
      header: common("status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={organization.name}
        description={t("detailDescription")}
        actions={
          canUpdate ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/organizations/${organization.id}/edit`} />}
            >
              <Pencil />
              {t("edit")}
            </Button>
          ) : undefined
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("detailTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailItem label={t("leader")}>
              {
                backoffice.users.find(
                  (user) => user.id === organization.leaderUserId,
                )?.nickname
              }
            </DetailItem>
            <DetailItem label={t("parent")}>
              {backoffice.organizations.find(
                (item) => item.id === organization.parentId,
              )?.name ?? t("noParent")}
            </DetailItem>
            <DetailItem label={common("createdAt")}>
              {labels.dateTime(organization.createdAt)}
            </DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>
      <AccessPolicyAssignmentCard
        targetType="organization"
        targetId={organization.id}
        targetName={organization.name}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("ownedServices")}</CardTitle>
            <CardDescription>{t("ownedServicesDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              caption={t("ownedServices")}
              columns={serviceColumns}
              data={ownedServices}
              getRowId={(row) => row.id}
              getRowHref={(row) => `/services/${row.id}`}
              getRowLabel={(row) => `${row.name} ${common("details")}`}
              empty={t("ownedServicesEmpty")}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("ownedCredentials")}</CardTitle>
            <CardDescription>
              {t("ownedCredentialsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              caption={t("ownedCredentials")}
              columns={credentialColumns}
              data={ownedCredentials}
              getRowId={(row) => row.id}
              getRowHref={(row) => `/credentials/${row.id}`}
              getRowLabel={(row) => `${row.name} ${common("details")}`}
              empty={t("ownedCredentialsEmpty")}
            />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="grid gap-1.5">
            <CardTitle>{t("roles")}</CardTitle>
            <CardDescription>{t("rolesDescription")}</CardDescription>
          </div>
          {canAssignRoles ? (
            <AddOrganizationRolesDialog organization={organization} />
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {roles.length ? (
            roles.map((role) => (
              <div
                key={role.id}
                className="flex items-center gap-2 rounded-lg border p-2"
              >
                <UiResourceLink
                  resourceKey={uiResourceKeys.roles.detail.key}
                  href={`/roles/${role.id}`}
                  className="min-w-0 flex-1 rounded-md px-1 py-1 text-primary hover:underline"
                >
                  {role.name}
                </UiResourceLink>
                {canAssignRoles ? (
                  <RelationshipRemoveAction
                    subjectName={organization.name}
                    targetName={role.name}
                    onRemove={() =>
                      backoffice.unassignOrganizationsFromRoles(
                        [organization.id],
                        [role.id],
                        sessionAccess.currentUser?.id ?? "",
                      )
                    }
                  />
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">{t("rolesEmpty")}</p>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="grid gap-1.5">
              <CardTitle>{t("members")}</CardTitle>
              <CardDescription>{t("membersDescription")}</CardDescription>
            </div>
            {canManageMembers ? (
              <AddOrganizationUsersDialog organization={organization} />
            ) : null}
          </CardHeader>
          <CardContent>
            <DataTable
              caption={t("members")}
              columns={memberColumns}
              data={members}
              getRowId={(row) => row.id}
              getRowHref={(row) =>
                canViewUserDetail ? `/users/${row.id}` : undefined
              }
              getRowLabel={(row) => `${row.nickname} ${common("details")}`}
              empty={t("membersEmpty")}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("children")}</CardTitle>
            <CardDescription>{t("childrenDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              caption={t("children")}
              columns={childColumns}
              data={children}
              getRowId={(row) => row.id}
              getRowHref={(row) =>
                canViewOrganizationDetail
                  ? `/organizations/${row.id}`
                  : undefined
              }
              getRowLabel={(row) => `${row.name} ${common("details")}`}
              empty={t("childrenEmpty")}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function UserDetailPage({ userId }: { userId: string }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const canAssignOrganizations = sessionAccess.canAccessUiResource(
    uiResourceKeys.users.detail.actions.assignUserOrganization,
  )
  const canAssignRoles = sessionAccess.canAccessUiResource(
    uiResourceKeys.users.detail.actions.assignUserRole,
  )
  const t = useTranslations("backoffice.users")
  const common = useTranslations("backoffice.common")
  const labels = useBackofficeLabels()
  const user = resolveVisibleDirectoryUsers(
    backoffice.users,
    sessionAccess.canAccessUiResource(
      uiResourceKeys.users.list.actions.createUser,
    ),
  ).find((item) => item.id === userId)
  if (!user)
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          sessionAccess.canAccessUiResource(uiResourceKeys.users.list.key) ? (
            <Button nativeButton={false} render={<Link href="/users" />}>
              {common("backToList")}
            </Button>
          ) : undefined
        }
      />
    )

  const organizations = backoffice.organizations.filter((organization) =>
    user.organizationIds.includes(organization.id),
  )
  const roles = backoffice.roles.filter((role) =>
    role.userIds.includes(user.id),
  )
  const effectivePolicyGrants = resolveEffectiveAccessPolicyGrants(
    backoffice,
    user.id,
  )

  function policyPathLabel(path: EffectiveAccessPolicyPath) {
    if (path.type === accessPolicyAssignmentTargets.user)
      return t("policyPathDirectUser")
    if (path.type === accessPolicyAssignmentTargets.organization) {
      const organization = backoffice.organizations.find(
        (candidate) => candidate.id === path.targetId,
      )
      if (!organization)
        throw new Error(`Policy organization not found: ${path.targetId}`)
      return t("policyPathOrganization", { name: organization.name })
    }
    const role = backoffice.roles.find(
      (candidate) => candidate.id === path.targetId,
    )
    if (!role) throw new Error(`Policy role not found: ${path.targetId}`)
    if (!path.viaOrganizationId) {
      return t("policyPathRole", { name: role.name })
    }
    const organization = backoffice.organizations.find(
      (candidate) => candidate.id === path.viaOrganizationId,
    )
    if (!organization) {
      throw new Error(
        `Policy role organization not found: ${path.viaOrganizationId}`,
      )
    }
    return t("policyPathOrganizationRole", {
      organization: organization.name,
      role: role.name,
    })
  }

  function policyGrantExpiration(paths: readonly EffectiveAccessPolicyPath[]) {
    if (paths.some((path) => path.expiresAt === null)) return t("noExpiration")
    const expiresAt = paths
      .map((path) => path.expiresAt)
      .filter((value): value is string => value !== null)
      .toSorted()
      .at(-1)
    return expiresAt ? labels.dateTime(expiresAt) : t("noExpiration")
  }

  const policyColumns: ColumnDef<EffectiveAccessPolicyGrant>[] = [
    {
      id: "policy",
      header: t("policyName"),
      cell: ({ row }) => (
        <UiResourceLink
          resourceKey={uiResourceKeys.approvalDocuments.detail.key}
          href={`/approval-documents/${row.original.policy.id}`}
        >
          {row.original.policy.name}
        </UiResourceLink>
      ),
    },
    {
      id: "effect",
      header: t("policyEffect"),
      cell: ({ row }) => (
        <AccessPolicyEffectBadge effect={row.original.policy.effect} />
      ),
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
    },
    {
      id: "expiresAt",
      header: t("policyExpiresAt"),
      cell: ({ row }) => policyGrantExpiration(row.original.paths),
    },
  ]
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={user.nickname}
        description={t("detailDescription")}
        actions={
          sessionAccess.canAccessUiResource(
            uiResourceKeys.users.detail.actions.changeEmploymentStatus,
          ) ? (
            <EmploymentStatusSelect
              status={user.employmentStatus}
              label={t("employmentStatusLabel", {
                nickname: user.nickname,
              })}
              onChange={(status) =>
                backoffice.setUserEmploymentStatus(
                  user.id,
                  status,
                  sessionAccess.currentUser?.id ?? "",
                )
              }
            />
          ) : undefined
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("detailTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailItem label={t("nickname")}>{user.nickname}</DetailItem>
            <DetailItem label={t("email")}>{user.email}</DetailItem>
            <DetailItem label={t("employmentStatus")}>
              <EmploymentStatusBadge status={user.employmentStatus} />
            </DetailItem>
            <DetailItem label={common("createdAt")}>
              {labels.dateTime(user.createdAt)}
            </DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("effectivePolicies")}</CardTitle>
          <CardDescription>{t("effectivePoliciesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            caption={t("effectivePolicies")}
            columns={policyColumns}
            data={[...effectivePolicyGrants]}
            getRowId={(row) => row.policy.id}
            getRowHref={(row) => `/approval-documents/${row.policy.id}`}
            getRowLabel={(row) => `${row.policy.name} ${common("details")}`}
            empty={t("effectivePoliciesEmpty")}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="grid gap-1.5">
            <CardTitle>{t("organizations")}</CardTitle>
            <CardDescription>{t("organizationsDescription")}</CardDescription>
          </div>
          {canAssignOrganizations ? (
            <AddUserOrganizationsDialog user={user} />
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {organizations.length ? (
            organizations.map((organization) => (
              <div
                key={organization.id}
                className="flex items-center gap-2 rounded-lg border p-2"
              >
                <UiResourceLink
                  resourceKey={uiResourceKeys.organizations.detail.key}
                  href={`/organizations/${organization.id}`}
                  className="min-w-0 flex-1 rounded-md px-1 py-1 text-primary hover:underline"
                >
                  {organization.name}
                </UiResourceLink>
                {canAssignOrganizations
                  ? (() => {
                      const impact = resolveOrganizationMembershipRemovalImpact(
                        backoffice,
                        user.id,
                        organization.id,
                      )
                      return (
                        <RelationshipRemoveAction
                          subjectName={user.nickname}
                          targetName={organization.name}
                          impactDescription={t("membershipRemovalImpact", {
                            roles: impact.lostRoleIds.length,
                            policies: impact.lostPolicyIds.length,
                            credentials: impact.lostCredentialIds.length,
                            requests: impact.affectedRequestIds.length,
                          })}
                          confirmDisabled={impact.blocked}
                          onRemove={() =>
                            backoffice.removeUsersFromOrganizations(
                              [user.id],
                              [organization.id],
                              sessionAccess.currentUser?.id ?? "",
                            )
                          }
                        />
                      )
                    })()
                  : null}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">{t("unassigned")}</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="grid gap-1.5">
            <CardTitle>{t("roles")}</CardTitle>
            <CardDescription>{t("rolesDescription")}</CardDescription>
          </div>
          {canAssignRoles ? <AddUserRolesDialog user={user} /> : null}
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {roles.length ? (
            roles.map((role) => (
              <div
                key={role.id}
                className="flex items-center gap-2 rounded-lg border p-2"
              >
                <UiResourceLink
                  resourceKey={uiResourceKeys.roles.detail.key}
                  href={`/roles/${role.id}`}
                  className="min-w-0 flex-1 rounded-md px-1 py-1 text-primary hover:underline"
                >
                  {role.name}
                </UiResourceLink>
                {canAssignRoles ? (
                  <RelationshipRemoveAction
                    subjectName={user.nickname}
                    targetName={role.name}
                    disabled={isSystemManagedRole(
                      backoffice.systemReferences,
                      role.id,
                    )}
                    onRemove={() =>
                      backoffice.unassignUsersFromRoles(
                        [user.id],
                        [role.id],
                        sessionAccess.currentUser?.id ?? "",
                      )
                    }
                  />
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">{t("rolesEmpty")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
