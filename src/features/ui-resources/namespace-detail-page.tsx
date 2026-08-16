"use client"

import { entityStatuses } from "@/domain/common"
import type { ColumnDef } from "@tanstack/react-table"
import { Archive, History, ShieldCheck, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { UiResourceLink } from "@/auth/ui-resource-link"
import { useBackoffice } from "@/application/state/provider"
import {
  CommandErrorMessage,
  StatusBadge,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"
import { ConfirmAction } from "@/components/patterns/confirm-action"
import { EmptyState } from "@/components/patterns/content-state"
import { DataTable } from "@/components/patterns/data-table"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import {
  FormDialog,
  FormDialogContent,
} from "@/components/patterns/form-dialog"
import { FormSelect } from "@/components/patterns/form-select"
import { MetricCard } from "@/components/patterns/metric-card"
import { PageHeader } from "@/components/patterns/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { snackbar } from "@/components/ui/snackbar"
import { uiResourceKeys } from "@/config/menu-registry"
import type { BackofficeErrorCode } from "@/domain/common"
import type {
  Namespace,
  UiResourceSyncHistory,
} from "@/features/ui-resources/model"

function NamespaceManagerDialog({ namespace }: { namespace: Namespace }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.namespaces")
  const [open, setOpen] = useState(false)
  const [roleId, setRoleId] = useState<string | null>(namespace.managerRoleId)
  const [error, setError] = useState<BackofficeErrorCode>()

  async function submit() {
    if (!roleId || !sessionAccess.currentUser) {
      setError("invalid-input")
      return
    }
    const result = await backoffice.updateNamespaceManager(
      namespace.id,
      roleId,
      sessionAccess.currentUser.id,
    )
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t("managerUpdated"))
    setOpen(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        setRoleId(namespace.managerRoleId)
        setError(undefined)
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <ShieldCheck />
        {t("changeManager")}
      </DialogTrigger>
      <FormDialogContent>
        <DialogHeader>
          <DialogTitle>{t("changeManagerTitle")}</DialogTitle>
          <DialogDescription>{t("changeManagerDescription")}</DialogDescription>
        </DialogHeader>
        <FormSelect
          label={t("managerRole")}
          value={roleId}
          onValueChange={setRoleId}
          options={backoffice.roles.map((role) => ({
            value: role.id,
            label: role.name,
          }))}
        />
        <CommandErrorMessage error={error} />
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {common("cancel")}
          </DialogClose>
          <Button
            onClick={() => void submit()}
            disabled={!roleId || roleId === namespace.managerRoleId}
          >
            {common("save")}
          </Button>
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}

export function NamespaceDetailPage({ namespaceId }: { namespaceId: string }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.namespaces")
  const errors = useTranslations("backoffice.errors")
  const labels = useBackofficeLabels()
  const namespace = backoffice.namespaces.find(
    (item) => item.id === namespaceId,
  )
  const canChangeManager = sessionAccess.canAccessUiResource(
    uiResourceKeys.namespaces.detail.actions.changeNamespaceManager,
  )
  const canRetire = sessionAccess.canAccessUiResource(
    uiResourceKeys.namespaces.detail.actions.retireNamespace,
  )

  if (!namespace) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          <Button nativeButton={false} render={<Link href="/namespaces" />}>
            {common("backToList")}
          </Button>
        }
      />
    )
  }
  const resources = backoffice.uiResources.filter(
    (resource) => resource.namespaceId === namespace.id,
  )
  const histories = backoffice.uiResourceSyncHistories
    .filter((history) => history.namespaceId === namespace.id)
    .toSorted((left, right) =>
      right.synchronizedAt.localeCompare(left.synchronizedAt),
    )
  const managerRole = backoffice.roles.find(
    (role) => role.id === namespace.managerRoleId,
  )
  const resolvedNamespaceId = namespace.id
  if (!managerRole) {
    throw new Error(`Namespace management role not found: ${namespace.id}`)
  }
  const managingOrganizations = managerRole.organizationIds.map(
    (organizationId) => {
      const organization = backoffice.organizations.find(
        (candidate) => candidate.id === organizationId,
      )
      if (!organization) {
        throw new Error(
          `Namespace management organization not found: ${organizationId}`,
        )
      }
      return organization
    },
  )
  const historyColumns: ColumnDef<UiResourceSyncHistory>[] = [
    {
      accessorKey: "synchronizedAt",
      header: t("synchronizedAt"),
      cell: ({ row }) => labels.dateTime(row.original.synchronizedAt),
    },
    {
      id: "actor",
      header: t("synchronizedBy"),
      cell: ({ row }) =>
        backoffice.users.find(
          (user) => user.id === row.original.synchronizedByUserId,
        )?.nickname ?? "—",
    },
    { accessorKey: "addedCount", header: t("addedCount") },
    { accessorKey: "updatedCount", header: t("updatedCount") },
    { accessorKey: "restoredCount", header: t("restoredCount") },
    { accessorKey: "orphanedCount", header: t("orphanedCount") },
  ]

  async function retire() {
    if (!sessionAccess.currentUser) return
    const result = await backoffice.retireNamespace(
      resolvedNamespaceId,
      sessionAccess.currentUser.id,
    )
    if (!result.ok) {
      snackbar.error(errors(result.error))
      return
    }
    snackbar.success(t("retired"))
    router.push("/namespaces")
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={namespace.name}
        description={namespace.description}
        actions={
          namespace.status === entityStatuses.active ? (
            <>
              {canChangeManager ? (
                <NamespaceManagerDialog namespace={namespace} />
              ) : null}
              {canRetire &&
              namespace.id !==
                backoffice.systemReferences.namespaceIds.backoffice ? (
                <ConfirmAction
                  trigger={
                    <>
                      <Archive />
                      {t("retire")}
                    </>
                  }
                  title={t("retireTitle")}
                  description={t("retireDescription", {
                    count: resources.length,
                  })}
                  confirmLabel={t("retire")}
                  cancelLabel={common("cancel")}
                  onConfirm={retire}
                />
              ) : null}
            </>
          ) : undefined
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={ShieldCheck}
          title={t("activeResourceCount")}
          value={
            resources.filter(
              (resource) =>
                resource.status === entityStatuses.active &&
                resource.orphanedAt === null,
            ).length
          }
        />
        <MetricCard
          icon={TriangleAlert}
          title={t("orphanedResourceCount")}
          value={
            resources.filter((resource) => resource.orphanedAt !== null).length
          }
        />
        <MetricCard
          icon={History}
          title={t("syncCount")}
          value={histories.length}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("detailTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailItem label={t("key")}>
              <code>{namespace.key}</code>
            </DetailItem>
            <DetailItem label={common("status")}>
              <StatusBadge status={namespace.status} />
            </DetailItem>
            <DetailItem label={t("managerRole")}>
              <UiResourceLink
                resourceKey={uiResourceKeys.roles.detail.key}
                href={`/roles/${managerRole.id}`}
              >
                {managerRole.name}
              </UiResourceLink>
            </DetailItem>
            <DetailItem label={t("managingOrganizations")}>
              {managingOrganizations.length > 0 ? (
                <span className="flex flex-wrap gap-2">
                  {managingOrganizations.map((organization) => (
                    <UiResourceLink
                      key={organization.id}
                      resourceKey={uiResourceKeys.organizations.detail.key}
                      href={`/organizations/${organization.id}`}
                    >
                      {organization.name}
                    </UiResourceLink>
                  ))}
                </span>
              ) : (
                common("none")
              )}
            </DetailItem>
            <DetailItem label={t("lastSyncedAt")}>
              {namespace.lastSyncedAt
                ? labels.dateTime(namespace.lastSyncedAt)
                : t("neverSynced")}
            </DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("syncHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            caption={t("syncHistory")}
            columns={historyColumns}
            data={histories}
            getRowId={(row) => row.id}
            empty={t("syncHistoryEmpty")}
          />
        </CardContent>
      </Card>
    </div>
  )
}
