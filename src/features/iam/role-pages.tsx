"use client"

import { uiResourceKeys } from "@/config/menu-registry"
import type { ColumnDef } from "@tanstack/react-table"
import { Building2, Pencil, ShieldCheck, Trash2, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { UiResourceLink } from "@/auth/ui-resource-link"
import { resolveVisibleDirectoryUsers } from "@/auth/user-directory-access"
import { EmptyState } from "@/components/patterns/content-state"
import { DataTable } from "@/components/patterns/data-table"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import { MetricCard } from "@/components/patterns/metric-card"
import { PageHeader } from "@/components/patterns/page-header"
import {
  FormDialog,
  FormDialogContent,
} from "@/components/patterns/form-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import { roleInputSchema } from "@/features/iam/model"
import { AssignmentDialog } from "@/application/ui/assignment-dialog"
import { isSystemManagedRole, isSystemRole } from "@/domain/system-references"
import type { BackofficeErrorCode } from "@/domain/common"
import type { BackofficeUser, Organization, Role } from "@/features/iam/model"
import { RelationshipRemoveAction } from "@/application/ui/relationship-remove-action"
import { AccessPolicyAssignmentCard } from "@/application/ui/access-policy-assignment-card"
import { ConfirmAction } from "@/components/patterns/confirm-action"
import { useBackoffice } from "@/application/state/provider"
import {
  EmploymentStatusBadge,
  CommandErrorMessage,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

function RoleCreationDialog() {
  const backoffice = useBackoffice()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.roles")
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<BackofficeErrorCode>()

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const parsed = roleInputSchema.safeParse({
      name: data.get("name"),
      description: data.get("description"),
    })
    if (!parsed.success) {
      setError("invalid-input")
      return
    }
    const result = await backoffice.createRole(parsed.data)
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t("created"))
    setError(undefined)
    setOpen(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        setError(undefined)
      }}
    >
      <DialogTrigger render={<Button />}>
        <ShieldCheck />
        {t("add")}
      </DialogTrigger>
      <FormDialogContent>
        <DialogHeader>
          <DialogTitle>{t("add")}</DialogTitle>
          <DialogDescription>{t("addDescription")}</DialogDescription>
        </DialogHeader>
        <form
          id="role-form"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(event.currentTarget)
          }}
        >
          <Field>
            <FieldLabel htmlFor="role-name">{t("roleName")}</FieldLabel>
            <Input
              id="role-name"
              name="name"
              required
              minLength={2}
              maxLength={80}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="role-description">
              {t("roleDescription")}
            </FieldLabel>
            <Textarea
              id="role-description"
              name="description"
              required
              minLength={2}
              maxLength={500}
              rows={5}
            />
          </Field>
          <CommandErrorMessage error={error} />
        </form>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {common("cancel")}
          </DialogClose>
          <Button type="submit" form="role-form">
            {common("create")}
          </Button>
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}

function AddRoleUsersDialog({ role }: { role: Role }) {
  const backoffice = useBackoffice()
  const t = useTranslations("backoffice.roles")
  const candidates = backoffice.users.filter(
    (user) => !role.userIds.includes(user.id),
  )

  return (
    <AssignmentDialog
      triggerLabel={t("addUsers")}
      title={t("addUsers")}
      description={t("addUsersDescription")}
      searchLabel={t("userSearch")}
      options={candidates.map((user) => ({
        id: user.id,
        title: user.nickname,
        description: user.email,
      }))}
      successMessage={t("usersAdded")}
      onAssign={(ids) => backoffice.assignUsersToRoles(ids, [role.id])}
    />
  )
}

function RoleUpdateDialog({ role }: { role: Role }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.roles")
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<BackofficeErrorCode>()

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const parsed = roleInputSchema.safeParse({
      name: data.get("name"),
      description: data.get("description"),
    })
    if (!parsed.success) {
      setError("invalid-input")
      return
    }
    const result = await backoffice.updateRole(
      role.id,
      parsed.data,
      sessionAccess.currentUser?.id ?? "",
    )
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t("updated"))
    setOpen(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        setError(undefined)
      }}
    >
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
          id="role-update-form"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(event.currentTarget)
          }}
        >
          <Field>
            <FieldLabel htmlFor="role-update-name">{t("roleName")}</FieldLabel>
            <Input
              id="role-update-name"
              name="name"
              defaultValue={role.name}
              required
              minLength={2}
              maxLength={80}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="role-update-description">
              {t("roleDescription")}
            </FieldLabel>
            <Textarea
              id="role-update-description"
              name="description"
              defaultValue={role.description}
              required
              minLength={2}
              maxLength={500}
              rows={5}
            />
          </Field>
          <CommandErrorMessage error={error} />
        </form>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {common("cancel")}
          </DialogClose>
          <Button type="submit" form="role-update-form">
            {common("save")}
          </Button>
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}

function AddRoleOrganizationsDialog({ role }: { role: Role }) {
  const backoffice = useBackoffice()
  const t = useTranslations("backoffice.roles")
  const candidates = backoffice.organizations.filter(
    (organization) => !role.organizationIds.includes(organization.id),
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
      onAssign={(ids) => backoffice.assignOrganizationsToRoles(ids, [role.id])}
    />
  )
}

export function RolesPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.roles")
  const labels = useBackofficeLabels()
  const canCreate = sessionAccess.canAccessUiResource(
    uiResourceKeys.roles.list.actions.createRole,
  )
  const canViewDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.roles.detail.key,
  )
  const columns = useMemo<ColumnDef<Role>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("roleName"),
      },
      { accessorKey: "description", header: t("roleDescription") },
      {
        id: "users",
        header: t("userCount"),
        cell: ({ row }) => row.original.userIds.length,
      },
      {
        id: "organizations",
        header: t("organizationCount"),
        cell: ({ row }) => row.original.organizationIds.length,
      },
      {
        accessorKey: "createdAt",
        header: common("createdAt"),
        cell: ({ row }) => labels.dateTime(row.original.createdAt),
      },
    ],
    [common, labels, t],
  )

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={canCreate ? <RoleCreationDialog /> : undefined}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={ShieldCheck}
          title={t("total")}
          value={backoffice.roles.length}
        />
        <MetricCard
          icon={Users}
          title={t("assignedUserCount")}
          value={new Set(backoffice.roles.flatMap((role) => role.userIds)).size}
        />
        <MetricCard
          icon={Building2}
          title={t("assignedOrganizationCount")}
          value={
            new Set(backoffice.roles.flatMap((role) => role.organizationIds))
              .size
          }
        />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        data={backoffice.roles}
        getRowId={(row) => row.id}
        getRowHref={(row) => (canViewDetail ? `/roles/${row.id}` : undefined)}
        getRowLabel={(row) => `${row.name} ${common("details")}`}
        empty={t("empty")}
        filterLabel={common("search")}
        noResults={common("noResults")}
        filters={[
          {
            id: "role-name",
            label: t("roleName"),
            getValue: (row) => row.name,
          },
          {
            id: "role-description",
            label: t("roleDescription"),
            getValue: (row) => row.description,
          },
        ]}
      />
      <p className="text-xs text-muted-foreground">{common("sessionNotice")}</p>
    </div>
  )
}

export function RoleDetailPage({ roleId }: { roleId: string }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const canAssignUsers = sessionAccess.canAccessUiResource(
    uiResourceKeys.roles.detail.actions.assignRoleUser,
  )
  const canAssignOrganizations = sessionAccess.canAccessUiResource(
    uiResourceKeys.roles.detail.actions.assignRoleOrganization,
  )
  const canAssignPolicies = sessionAccess.canAccessUiResource(
    uiResourceKeys.roles.detail.actions.assignRolePolicy,
  )
  const canUpdate = sessionAccess.canAccessUiResource(
    uiResourceKeys.roles.detail.actions.updateRole,
  )
  const canDelete = sessionAccess.canAccessUiResource(
    uiResourceKeys.roles.detail.actions.deleteRole,
  )
  const canViewUserDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.users.detail.key,
  )
  const canViewOrganizationDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.organizations.detail.key,
  )
  const common = useTranslations("backoffice.common")
  const errors = useTranslations("backoffice.errors")
  const t = useTranslations("backoffice.roles")
  const usersT = useTranslations("backoffice.users")
  const organizationsT = useTranslations("backoffice.organizations")
  const labels = useBackofficeLabels()
  const role = backoffice.roles.find((item) => item.id === roleId)

  if (!role) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          sessionAccess.canAccessUiResource(uiResourceKeys.roles.list.key) ? (
            <Button render={<Link href="/roles" />}>
              {common("backToList")}
            </Button>
          ) : undefined
        }
      />
    )
  }

  const systemRole = isSystemRole(backoffice.systemReferences, role.id)
  const managedRole = isSystemManagedRole(backoffice.systemReferences, role.id)
  const visibleUsers = resolveVisibleDirectoryUsers(
    backoffice.users,
    sessionAccess.canAccessUiResource(uiResourceKeys.users.list.key),
  )
  const users = visibleUsers.filter((user) => role.userIds.includes(user.id))
  const organizations = backoffice.organizations.filter((organization) =>
    role.organizationIds.includes(organization.id),
  )
  const userColumns: ColumnDef<BackofficeUser>[] = [
    {
      accessorKey: "nickname",
      header: usersT("nickname"),
      cell: ({ row }) => (
        <UiResourceLink
          resourceKey={uiResourceKeys.users.detail.key}
          className="text-primary hover:underline"
          href={"/users/" + row.original.id}
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
    ...(canAssignUsers
      ? [
          {
            id: "actions",
            header: common("actions"),
            size: 96,
            cell: ({ row }) => (
              <RelationshipRemoveAction
                subjectName={role.name}
                targetName={row.original.nickname}
                disabled={managedRole}
                onRemove={() =>
                  backoffice.unassignUsersFromRoles(
                    [row.original.id],
                    [role.id],
                  )
                }
              />
            ),
          } satisfies ColumnDef<BackofficeUser>,
        ]
      : []),
  ]
  const organizationColumns: ColumnDef<Organization>[] = [
    {
      accessorKey: "name",
      header: organizationsT("organizationName"),
      cell: ({ row }) => (
        <UiResourceLink
          resourceKey={uiResourceKeys.organizations.detail.key}
          className="text-primary hover:underline"
          href={"/organizations/" + row.original.id}
        >
          {row.original.name}
        </UiResourceLink>
      ),
    },
    {
      id: "leader",
      header: organizationsT("leader"),
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
    ...(canAssignOrganizations
      ? [
          {
            id: "actions",
            header: common("actions"),
            size: 96,
            cell: ({ row }) => (
              <RelationshipRemoveAction
                subjectName={role.name}
                targetName={row.original.name}
                onRemove={() =>
                  backoffice.unassignOrganizationsFromRoles(
                    [row.original.id],
                    [role.id],
                  )
                }
              />
            ),
          } satisfies ColumnDef<Organization>,
        ]
      : []),
  ]
  const assignmentCount = backoffice.accessPolicyAssignments.filter(
    (assignment) =>
      assignment.targetType === "role" && assignment.targetId === role.id,
  ).length
  const deleteImpactCount =
    users.length + organizations.length + assignmentCount
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={role.name}
        description={t("detailDescription")}
        actions={
          !systemRole && (canUpdate || canDelete) ? (
            <>
              {canUpdate ? <RoleUpdateDialog role={role} /> : null}
              {canDelete ? (
                <ConfirmAction
                  trigger={
                    <>
                      <Trash2 />
                      {common("delete")}
                    </>
                  }
                  title={t("deleteTitle", { name: role.name })}
                  description={t("deleteDescription", {
                    users: users.length,
                    organizations: organizations.length,
                    policies: assignmentCount,
                  })}
                  confirmLabel={common("delete")}
                  cancelLabel={common("cancel")}
                  confirmDisabled={deleteImpactCount > 0}
                  onConfirm={async () => {
                    const result = await backoffice.deleteRole(
                      role.id,
                      sessionAccess.currentUser?.id ?? "",
                    )
                    if (!result.ok) {
                      snackbar.error(errors(result.error))
                      return
                    }
                    snackbar.success(t("deleted"))
                    router.push("/roles")
                  }}
                />
              ) : null}
            </>
          ) : undefined
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("detailTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailItem label={t("roleDescription")} className="sm:col-span-2">
              {role.description}
            </DetailItem>
            <DetailItem label={t("userCount")}>{users.length}</DetailItem>
            <DetailItem label={t("organizationCount")}>
              {organizations.length}
            </DetailItem>
            <DetailItem label={common("createdAt")} className="sm:col-span-2">
              {labels.dateTime(role.createdAt)}
            </DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>
      <AccessPolicyAssignmentCard
        targetType="role"
        targetId={role.id}
        targetName={role.name}
        canManage={canAssignPolicies}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="grid gap-1.5">
              <CardTitle>{t("assignedUsers")}</CardTitle>
              <CardDescription>{t("assignedUsersDescription")}</CardDescription>
            </div>
            {canAssignUsers && !managedRole ? (
              <AddRoleUsersDialog role={role} />
            ) : null}
          </CardHeader>
          <CardContent>
            <DataTable
              caption={t("assignedUsers")}
              columns={userColumns}
              data={users}
              getRowId={(row) => row.id}
              getRowHref={(row) =>
                canViewUserDetail ? `/users/${row.id}` : undefined
              }
              getRowLabel={(row) => `${row.nickname} ${common("details")}`}
              empty={t("assignedUsersEmpty")}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="grid gap-1.5">
              <CardTitle>{t("assignedOrganizations")}</CardTitle>
              <CardDescription>
                {t("assignedOrganizationsDescription")}
              </CardDescription>
            </div>
            {canAssignOrganizations && !managedRole ? (
              <AddRoleOrganizationsDialog role={role} />
            ) : null}
          </CardHeader>
          <CardContent>
            <DataTable
              caption={t("assignedOrganizations")}
              columns={organizationColumns}
              data={organizations}
              getRowId={(row) => row.id}
              getRowHref={(row) =>
                canViewOrganizationDetail
                  ? `/organizations/${row.id}`
                  : undefined
              }
              getRowLabel={(row) => `${row.name} ${common("details")}`}
              empty={t("assignedOrganizationsEmpty")}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
