"use client"

import { uiResourceKeys } from "@/config/menu-registry"
import type { ColumnDef } from "@tanstack/react-table"
import { Pencil, Trash2, UserRoundCog, Users } from "lucide-react"
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
import { groupInputSchema } from "@/features/iam/model"
import { AssignmentDialog } from "@/application/ui/assignment-dialog"
import { isSystemGroup, isSystemManagedGroup } from "@/domain/system-references"
import type { BackofficeErrorCode } from "@/domain/common"
import type { BackofficeUser, Group } from "@/features/iam/model"
import { RelationshipRemoveAction } from "@/application/ui/relationship-remove-action"
import { AccessPolicyAssignmentCard } from "@/application/ui/access-policy-assignment-card"
import { ConfirmAction } from "@/components/patterns/confirm-action"
import { useBackoffice } from "@/application/state/provider"
import {
  EmploymentStatusBadge,
  CommandErrorMessage,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

function GroupCreationDialog() {
  const backoffice = useBackoffice()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.groups")
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<BackofficeErrorCode>()

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const parsed = groupInputSchema.safeParse({
      name: data.get("name"),
      description: data.get("description"),
    })
    if (!parsed.success) {
      setError("invalid-input")
      return
    }
    const result = await backoffice.createGroup(parsed.data)
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
        <UserRoundCog />
        {t("add")}
      </DialogTrigger>
      <FormDialogContent>
        <DialogHeader>
          <DialogTitle>{t("add")}</DialogTitle>
          <DialogDescription>{t("addDescription")}</DialogDescription>
        </DialogHeader>
        <form
          id="group-form"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(event.currentTarget)
          }}
        >
          <Field>
            <FieldLabel htmlFor="group-name">{t("groupName")}</FieldLabel>
            <Input
              id="group-name"
              name="name"
              required
              minLength={2}
              maxLength={80}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="group-description">
              {t("groupDescription")}
            </FieldLabel>
            <Textarea
              id="group-description"
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
          <Button type="submit" form="group-form">
            {common("create")}
          </Button>
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}

function AddGroupUsersDialog({ group }: { group: Group }) {
  const backoffice = useBackoffice()
  const t = useTranslations("backoffice.groups")
  const candidates = backoffice.users.filter(
    (user) => !group.userIds.includes(user.id),
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
      onAssign={(ids) => backoffice.assignUsersToGroups(ids, [group.id])}
    />
  )
}

function GroupUpdateDialog({ group }: { group: Group }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.groups")
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<BackofficeErrorCode>()

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const parsed = groupInputSchema.safeParse({
      name: data.get("name"),
      description: data.get("description"),
    })
    if (!parsed.success) {
      setError("invalid-input")
      return
    }
    const result = await backoffice.updateGroup(
      group.id,
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
          id="group-update-form"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(event.currentTarget)
          }}
        >
          <Field>
            <FieldLabel htmlFor="group-update-name">
              {t("groupName")}
            </FieldLabel>
            <Input
              id="group-update-name"
              name="name"
              defaultValue={group.name}
              required
              minLength={2}
              maxLength={80}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="group-update-description">
              {t("groupDescription")}
            </FieldLabel>
            <Textarea
              id="group-update-description"
              name="description"
              defaultValue={group.description}
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
          <Button type="submit" form="group-update-form">
            {common("save")}
          </Button>
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}

export function GroupsPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.groups")
  const labels = useBackofficeLabels()
  const canCreate = sessionAccess.canAccessUiResource(
    uiResourceKeys.groups.list.actions.createGroup,
  )
  const canViewDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.groups.detail.key,
  )
  const columns = useMemo<ColumnDef<Group>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("groupName"),
      },
      { accessorKey: "description", header: t("groupDescription") },
      {
        id: "users",
        header: t("userCount"),
        cell: ({ row }) => row.original.userIds.length,
      },
      {
        accessorKey: "createdAt",
        header: common("createdAt"),
        cell: ({ row }) => labels.dateTime(row.original.createdAt),
      },
    ],
    [common, labels, t],
  )
  const leaderGroup = backoffice.groups.find(
    (group) =>
      group.id === backoffice.systemReferences.groupIds.organizationLeader,
  )

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={canCreate ? <GroupCreationDialog /> : undefined}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={UserRoundCog}
          title={t("total")}
          value={backoffice.groups.length}
        />
        <MetricCard
          icon={Users}
          title={t("assignedUserCount")}
          value={
            new Set(backoffice.groups.flatMap((group) => group.userIds)).size
          }
        />
        <MetricCard
          icon={Users}
          title={t("leaderCount")}
          value={leaderGroup?.userIds.length ?? 0}
        />
      </div>
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        data={backoffice.groups}
        getRowId={(row) => row.id}
        getRowHref={(row) => (canViewDetail ? `/groups/${row.id}` : undefined)}
        getRowLabel={(row) => `${row.name} ${common("details")}`}
        empty={t("empty")}
        filterLabel={common("search")}
        noResults={common("noResults")}
        filters={[
          {
            id: "group-name",
            label: t("groupName"),
            getValue: (row) => row.name,
          },
          {
            id: "group-description",
            label: t("groupDescription"),
            getValue: (row) => row.description,
          },
        ]}
      />
      <p className="text-xs text-muted-foreground">{common("sessionNotice")}</p>
    </div>
  )
}

export function GroupDetailPage({ groupId }: { groupId: string }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const canAssignUsers = sessionAccess.canAccessUiResource(
    uiResourceKeys.groups.detail.actions.assignGroupUser,
  )
  const canViewUserDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.users.detail.key,
  )
  const canAssignPolicies = sessionAccess.canAccessUiResource(
    uiResourceKeys.groups.detail.actions.assignGroupPolicy,
  )
  const canUpdate = sessionAccess.canAccessUiResource(
    uiResourceKeys.groups.detail.actions.updateGroup,
  )
  const canDelete = sessionAccess.canAccessUiResource(
    uiResourceKeys.groups.detail.actions.deleteGroup,
  )
  const common = useTranslations("backoffice.common")
  const errors = useTranslations("backoffice.errors")
  const t = useTranslations("backoffice.groups")
  const usersT = useTranslations("backoffice.users")
  const labels = useBackofficeLabels()
  const group = backoffice.groups.find((item) => item.id === groupId)

  if (!group) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          sessionAccess.canAccessUiResource(uiResourceKeys.groups.list.key) ? (
            <Button render={<Link href="/groups" />}>
              {common("backToList")}
            </Button>
          ) : undefined
        }
      />
    )
  }

  const isOrganizationLeaderGroup =
    group.id === backoffice.systemReferences.groupIds.organizationLeader
  const isManagedGroup = isSystemManagedGroup(
    backoffice.systemReferences,
    group.id,
  )
  const systemGroup = isSystemGroup(backoffice.systemReferences, group.id)
  const users = resolveVisibleDirectoryUsers(
    backoffice.users,
    sessionAccess.canAccessUiResource(uiResourceKeys.users.list.key),
  ).filter((user) => group.userIds.includes(user.id))
  const columns: ColumnDef<BackofficeUser>[] = [
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
    ...(canAssignUsers
      ? [
          {
            id: "actions",
            header: common("actions"),
            size: 110,
            cell: ({ row }) => (
              <RelationshipRemoveAction
                subjectName={group.name}
                targetName={row.original.nickname}
                disabled={isManagedGroup}
                onRemove={() =>
                  backoffice.unassignUsersFromGroups(
                    [row.original.id],
                    [group.id],
                  )
                }
              />
            ),
          } satisfies ColumnDef<BackofficeUser>,
        ]
      : []),
  ]
  const assignmentCount = backoffice.accessPolicyAssignments.filter(
    (assignment) =>
      assignment.targetType === "group" && assignment.targetId === group.id,
  ).length
  const deleteImpactCount = users.length + assignmentCount

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={group.name}
        description={t("detailDescription")}
        actions={
          !systemGroup && (canUpdate || canDelete) ? (
            <>
              {canUpdate ? <GroupUpdateDialog group={group} /> : null}
              {canDelete ? (
                <ConfirmAction
                  trigger={
                    <>
                      <Trash2 />
                      {common("delete")}
                    </>
                  }
                  title={t("deleteTitle", { name: group.name })}
                  description={t("deleteDescription", {
                    users: users.length,
                    policies: assignmentCount,
                  })}
                  confirmLabel={common("delete")}
                  cancelLabel={common("cancel")}
                  confirmDisabled={deleteImpactCount > 0}
                  onConfirm={async () => {
                    const result = await backoffice.deleteGroup(
                      group.id,
                      sessionAccess.currentUser?.id ?? "",
                    )
                    if (!result.ok) {
                      snackbar.error(errors(result.error))
                      return
                    }
                    snackbar.success(t("deleted"))
                    router.push("/groups")
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
            <DetailItem label={t("groupDescription")} className="sm:col-span-2">
              {group.description}
            </DetailItem>
            <DetailItem label={t("userCount")}>{users.length}</DetailItem>
            <DetailItem label={common("createdAt")}>
              {labels.dateTime(group.createdAt)}
            </DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>
      <AccessPolicyAssignmentCard
        targetType="group"
        targetId={group.id}
        targetName={group.name}
        canManage={!systemGroup && canAssignPolicies}
      />
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="grid gap-1.5">
            <CardTitle>{t("assignedUsers")}</CardTitle>
            <CardDescription>
              {t(
                isOrganizationLeaderGroup
                  ? "systemUsersDescription"
                  : "assignedUsersDescription",
              )}
            </CardDescription>
          </div>
          {!isManagedGroup && canAssignUsers ? (
            <AddGroupUsersDialog group={group} />
          ) : null}
        </CardHeader>
        <CardContent>
          <DataTable
            caption={t("assignedUsers")}
            columns={columns}
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
    </div>
  )
}
