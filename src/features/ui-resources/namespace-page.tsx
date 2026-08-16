"use client"

import { uiResourceKeys } from "@/config/menu-registry"
import type { ColumnDef } from "@tanstack/react-table"
import { Layers3, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { DataTable } from "@/components/patterns/data-table"
import { FormSelect } from "@/components/patterns/form-select"
import {
  FormDialog,
  FormDialogContent,
} from "@/components/patterns/form-dialog"
import { MetricCard } from "@/components/patterns/metric-card"
import { PageHeader } from "@/components/patterns/page-header"
import { Button } from "@/components/ui/button"
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import { namespaceInputSchema } from "@/features/ui-resources/model"
import type { BackofficeErrorCode } from "@/domain/common"
import type { Namespace } from "@/features/ui-resources/model"
import { useBackoffice } from "@/application/state/provider"
import {
  StatusBadge,
  CommandErrorMessage,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

function NamespaceCreationDialog() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.namespaces")
  const common = useTranslations("backoffice.common")
  const [open, setOpen] = useState(false)
  const [managerRoleId, setManagerRoleId] = useState<string | null>(null)
  const [error, setError] = useState<BackofficeErrorCode>()
  const formId = "namespace-create-form"

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    setManagerRoleId(null)
    setError(undefined)
  }

  async function submit(form: HTMLFormElement) {
    const requesterId = sessionAccess.currentUser?.id
    if (!requesterId) {
      setError("namespace-operation-forbidden")
      return
    }
    const data = new FormData(form)
    const parsed = namespaceInputSchema.safeParse({
      key: data.get("key"),
      name: data.get("name"),
      description: data.get("description"),
      managerRoleId,
    })
    if (!parsed.success) {
      setError("invalid-input")
      return
    }
    const result = await backoffice.createNamespace(parsed.data, requesterId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t("created"))
    setOpen(false)
  }

  return (
    <FormDialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger
        render={
          <Button
            data-ui-resource={
              uiResourceKeys.namespaces.list.actions.createNamespace
            }
          />
        }
      >
        <Plus aria-hidden />
        {t("add")}
      </DialogTrigger>
      <FormDialogContent>
        <DialogHeader>
          <DialogTitle>{t("add")}</DialogTitle>
          <DialogDescription>{t("addDescription")}</DialogDescription>
        </DialogHeader>
        <form
          id={formId}
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(event.currentTarget)
          }}
        >
          <Field>
            <FieldLabel htmlFor="namespace-key">{t("key")}</FieldLabel>
            <Input
              id="namespace-key"
              name="key"
              required
              minLength={2}
              maxLength={60}
              pattern="[a-z][a-z0-9]*(?:-[a-z0-9]+)*"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby="namespace-key-description"
            />
            <FieldDescription id="namespace-key-description">
              {t("keyDescription")}
            </FieldDescription>
          </Field>
          <FormSelect
            label={t("managerRole")}
            value={managerRoleId}
            onValueChange={(value) => {
              setManagerRoleId(value)
              setError(undefined)
            }}
            options={[...backoffice.roles]
              .sort((left, right) => left.name.localeCompare(right.name, "ko"))
              .map((role) => ({ value: role.id, label: role.name }))}
          />
          <FieldDescription>{t("managerRoleDescription")}</FieldDescription>
          <Field>
            <FieldLabel htmlFor="namespace-name">{common("name")}</FieldLabel>
            <Input
              id="namespace-name"
              name="name"
              required
              minLength={2}
              maxLength={100}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="namespace-description">
              {t("namespaceDescription")}
            </FieldLabel>
            <Textarea
              id="namespace-description"
              name="description"
              required
              minLength={2}
              maxLength={500}
            />
          </Field>
          <CommandErrorMessage error={error} />
        </form>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {common("cancel")}
          </DialogClose>
          <Button type="submit" form={formId} disabled={!managerRoleId}>
            {common("create")}
          </Button>
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}

function NamespacesTable({
  data,
  canViewDetail,
}: {
  data: Namespace[]
  canViewDetail: boolean
}) {
  const backoffice = useBackoffice()
  const t = useTranslations("backoffice.namespaces")
  const common = useTranslations("backoffice.common")
  const labels = useBackofficeLabels()
  const columns = useMemo<ColumnDef<Namespace>[]>(
    () => [
      {
        accessorKey: "key",
        header: t("key"),
        size: 180,
        cell: ({ row }) => <code>{row.original.key}</code>,
      },
      { accessorKey: "name", header: common("name"), size: 180 },
      {
        accessorKey: "description",
        header: t("namespaceDescription"),
        size: 340,
      },
      {
        id: "managerRole",
        header: t("managerRole"),
        size: 200,
        cell: ({ row }) => {
          const role = backoffice.roles.find(
            (candidate) => candidate.id === row.original.managerRoleId,
          )
          if (!role) {
            throw new Error(
              `Namespace management role not found: ${row.original.managerRoleId}`,
            )
          }
          return role.name
        },
      },
      {
        accessorKey: "lastSyncedAt",
        header: t("lastSyncedAt"),
        size: 180,
        cell: ({ row }) =>
          row.original.lastSyncedAt
            ? labels.dateTime(row.original.lastSyncedAt)
            : t("neverSynced"),
      },
      {
        accessorKey: "status",
        header: common("status"),
        size: 100,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [common, labels, t, backoffice.roles],
  )
  return (
    <DataTable
      caption={t("tableCaption")}
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      getRowHref={(row) =>
        canViewDetail ? `/namespaces/${row.id}` : undefined
      }
      getRowLabel={(row) => `${row.name} ${common("details")}`}
      empty={t("empty")}
      filterLabel={common("search")}
      noResults={common("noResults")}
      filters={[
        { id: "key", label: t("key"), getValue: (row) => row.key },
        { id: "name", label: common("name"), getValue: (row) => row.name },
      ]}
    />
  )
}

export function NamespacesPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.namespaces")
  const canCreate = sessionAccess.canAccessUiResource(
    uiResourceKeys.namespaces.list.actions.createNamespace,
  )
  const canViewDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.namespaces.detail.key,
  )

  return (
    <div
      className="grid gap-6"
      data-ui-resource={uiResourceKeys.namespaces.list.key}
    >
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={canCreate ? <NamespaceCreationDialog /> : null}
      />
      <div className="grid gap-3">
        <MetricCard
          icon={Layers3}
          title={t("total")}
          value={backoffice.namespaces.length}
        />
      </div>
      <NamespacesTable
        data={backoffice.namespaces}
        canViewDetail={canViewDetail}
      />
    </div>
  )
}
