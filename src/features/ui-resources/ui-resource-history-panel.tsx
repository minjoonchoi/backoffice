"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { GitCompareArrows, RotateCcw, TriangleAlert } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { useBackoffice } from "@/application/state/provider"
import { useBackofficeLabels } from "@/application/ui/backoffice-ui"
import { ConfirmAction } from "@/components/patterns/confirm-action"
import { DataTable } from "@/components/patterns/data-table"
import { FormSelect } from "@/components/patterns/form-select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { snackbar } from "@/components/ui/snackbar"
import { uiResourceKeys, uiResourceManifest } from "@/config/menu-registry"
import {
  compareManifestWithUiResources,
  compareUiResourceSyncs,
} from "@/features/ui-resources/ui-resource-history"
import type { UiResourceSyncHistory } from "@/features/ui-resources/model"

export function UiResourceHistoryPanel({
  namespaceIds,
}: {
  namespaceIds: ReadonlySet<string>
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.uiResources")
  const labels = useBackofficeLabels()
  const histories = backoffice.uiResourceSyncHistories
    .filter((history) => namespaceIds.has(history.namespaceId))
    .toSorted((left, right) =>
      right.synchronizedAt.localeCompare(left.synchronizedAt),
    )
  const canCompare = sessionAccess.canAccessUiResource(
    uiResourceKeys.uiResources.list.actions.compareUiResourceSyncs,
  )
  const canRestore = sessionAccess.canAccessUiResource(
    uiResourceKeys.uiResources.list.actions.restoreUiResourceSync,
  )
  const backofficeNamespace = backoffice.namespaces.find(
    (namespace) =>
      namespace.id === backoffice.systemReferences.namespaceIds.backoffice &&
      namespaceIds.has(namespace.id),
  )
  const mismatch = backofficeNamespace
    ? compareManifestWithUiResources(
        uiResourceManifest,
        backoffice.uiResources.filter(
          (resource) => resource.namespaceId === backofficeNamespace.id,
        ),
      )
    : null
  const mismatchCount = mismatch
    ? mismatch.onlyInCode.length +
      mismatch.onlyOnServer.length +
      mismatch.changed.length
    : 0

  const restore = useCallback(
    async (history: UiResourceSyncHistory) => {
      if (!sessionAccess.currentUser) return
      const result = await backoffice.restoreUiResourceSync(
        history.id,
        sessionAccess.currentUser.id,
      )
      if (!result.ok) {
        snackbar.error(t("restoreFailed"))
        return
      }
      snackbar.success(t("restoredSync"))
    },
    [backoffice, sessionAccess.currentUser, t],
  )

  const columns = useMemo<ColumnDef<UiResourceSyncHistory>[]>(
    () => [
      {
        id: "namespace",
        header: t("namespace"),
        cell: ({ row }) =>
          backoffice.namespaces.find(
            (namespace) => namespace.id === row.original.namespaceId,
          )?.name ?? "—",
      },
      {
        accessorKey: "synchronizedAt",
        header: t("synchronizedAt"),
        cell: ({ row }) => labels.dateTime(row.original.synchronizedAt),
      },
      { accessorKey: "addedCount", header: t("addedCount") },
      { accessorKey: "updatedCount", header: t("updatedCount") },
      { accessorKey: "restoredCount", header: t("restoredCount") },
      { accessorKey: "orphanedCount", header: t("orphanedCount") },
      ...(canRestore
        ? [
            {
              id: "actions",
              header: common("actions"),
              size: 100,
              cell: ({ row }) => (
                <ConfirmAction
                  trigger={
                    <>
                      <RotateCcw />
                      {t("restore")}
                    </>
                  }
                  title={t("restoreTitle")}
                  description={t("restoreDescription")}
                  confirmLabel={t("restore")}
                  cancelLabel={common("cancel")}
                  onConfirm={() => restore(row.original)}
                />
              ),
            } satisfies ColumnDef<UiResourceSyncHistory>,
          ]
        : []),
    ],
    [backoffice.namespaces, canRestore, common, labels, restore, t],
  )

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="grid gap-1.5">
          <CardTitle>{t("syncHistory")}</CardTitle>
          <CardDescription>{t("syncHistoryDescription")}</CardDescription>
        </div>
        {canCompare && histories.length >= 2 ? (
          <UiResourceSyncComparisonDialog histories={histories} />
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        {mismatchCount > 0 ? (
          <Alert variant="warning">
            <TriangleAlert />
            <AlertTitle>{t("manifestMismatchTitle")}</AlertTitle>
            <AlertDescription>
              {t("manifestMismatchDescription", {
                code: mismatch?.onlyInCode.length ?? 0,
                server: mismatch?.onlyOnServer.length ?? 0,
                changed: mismatch?.changed.length ?? 0,
              })}
            </AlertDescription>
          </Alert>
        ) : null}
        <DataTable
          caption={t("syncHistory")}
          columns={columns}
          data={histories}
          getRowId={(row) => row.id}
          empty={t("syncHistoryEmpty")}
        />
      </CardContent>
    </Card>
  )
}

function UiResourceSyncComparisonDialog({
  histories,
}: {
  histories: readonly UiResourceSyncHistory[]
}) {
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.uiResources")
  const [previousId, setPreviousId] = useState(histories[1]?.id ?? "")
  const [currentId, setCurrentId] = useState(histories[0]?.id ?? "")
  const previous = histories.find((history) => history.id === previousId)
  const current = histories.find((history) => history.id === currentId)
  const comparison =
    previous && current && previous.id !== current.id
      ? compareUiResourceSyncs(previous, current)
      : null
  const options = histories.map((history) => ({
    value: history.id,
    label: new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(history.synchronizedAt)),
  }))

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <GitCompareArrows />
        {t("compareSyncs")}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("compareSyncsTitle")}</DialogTitle>
          <DialogDescription>{t("compareSyncsDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect
            label={t("previousSync")}
            value={previousId}
            onValueChange={(value) => {
              setPreviousId(value ?? "")
            }}
            options={options}
          />
          <FormSelect
            label={t("currentSync")}
            value={currentId}
            onValueChange={(value) => {
              setCurrentId(value ?? "")
            }}
            options={options}
          />
        </div>
        {comparison ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ComparisonList
              title={t("addedResources")}
              values={comparison.addedKeys}
              variant="success"
            />
            <ComparisonList
              title={t("removedResources")}
              values={comparison.removedKeys}
              variant="destructive"
            />
            <ComparisonList
              title={t("changedResources")}
              values={comparison.changedKeys}
              variant="warning"
            />
            <ComparisonList
              title={t("restoredResources")}
              values={comparison.restoredKeys}
              variant="info"
            />
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button />}>{common("close")}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ComparisonList({
  title,
  values,
  variant,
}: {
  title: string
  values: readonly string[]
  variant: "success" | "destructive" | "warning" | "info"
}) {
  return (
    <section className="grid content-start gap-2 rounded-card border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant={variant}>{values.length}</Badge>
      </div>
      <ul className="grid max-h-48 gap-1 overflow-y-auto text-xs text-muted-foreground">
        {values.map((value) => (
          <li key={value} className="truncate" title={value}>
            {value}
          </li>
        ))}
      </ul>
    </section>
  )
}
