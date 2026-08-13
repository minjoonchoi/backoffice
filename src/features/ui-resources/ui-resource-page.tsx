"use client"

import { uiResourceKeys } from "@/config/menu-registry"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Boxes,
  Check,
  Layers3,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { hasEffectiveAccessPolicyResource } from "@/features/access-policies/access-policy-assignment"
import { resolveUiResourceAccess } from "@/auth/ui-resource-access"
import { DataTable } from "@/components/patterns/data-table"
import {
  FormDialog,
  FormDialogContent,
} from "@/components/patterns/form-dialog"
import { MetricCard } from "@/components/patterns/metric-card"
import { PageHeader } from "@/components/patterns/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import { FormSelect } from "@/components/patterns/form-select"
import type {
  UiResource,
  UiResourceImportResult,
  UiResourceType,
  UiNamespace,
} from "@/features/ui-resources/model"
import type { BackofficeErrorCode } from "@/domain/common"
import {
  parseUiResourceManifestText,
  uiResourceManifestSchema,
  type UiResourceManifest,
  type UiResourceManifestFormat,
} from "@/features/ui-resources/ui-resource-manifest"
import {
  previewUiResourceSync,
  type UiResourceSyncPreview,
} from "@/features/ui-resources/ui-resource-sync"
import { useBackoffice } from "@/application/state/provider"
import {
  CommandErrorMessage,
  StatusSwitch,
} from "@/application/ui/backoffice-ui"
import { resolveUiResourceVisibilities } from "@/features/ui-resources/ui-resource-visibility"

function UiResourceTypeBadge({ type }: { type: UiResourceType }) {
  const t = useTranslations("backoffice.uiResources.types")
  return (
    <Badge variant={type === "action" ? "info" : "secondary"}>{t(type)}</Badge>
  )
}

function UiResourceImportDialog({ namespaces }: { namespaces: UiNamespace[] }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.uiResources")
  const common = useTranslations("backoffice.common")
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<UiResourceManifestFormat>("yaml")
  const [namespaceId, setNamespaceId] = useState<string | null>(null)
  const [source, setSource] = useState("")
  const [preview, setPreview] = useState<UiResourceSyncPreview>()
  const [candidateManifest, setCandidateManifest] =
    useState<UiResourceManifest>()
  const [selectedResourceKeys, setSelectedResourceKeys] = useState<Set<string>>(
    new Set(),
  )
  const [grantAdministratorAccess, setGrantAdministratorAccess] = useState(true)
  const [result, setResult] = useState<UiResourceImportResult>()
  const [selectedOrphanIds, setSelectedOrphanIds] = useState<Set<string>>(
    new Set(),
  )
  const [error, setError] = useState<BackofficeErrorCode>()
  const formId = "ui-resource-import-form"

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    setFormat("yaml")
    setNamespaceId(namespaces[0]?.id ?? null)
    setSource("")
    setPreview(undefined)
    setCandidateManifest(undefined)
    setSelectedResourceKeys(new Set())
    setGrantAdministratorAccess(true)
    setResult(undefined)
    setSelectedOrphanIds(new Set())
    setError(undefined)
  }

  function review() {
    const namespace = namespaces.find((item) => item.id === namespaceId)
    if (!namespace) {
      setError("ui-namespace-not-found")
      return
    }

    let manifest: unknown
    try {
      manifest = parseUiResourceManifestText(source, format)
    } catch {
      setError("invalid-input")
      return
    }
    const parsed = uiResourceManifestSchema.safeParse(manifest)
    if (!parsed.success) {
      setError("invalid-input")
      return
    }
    const targetedManifest = {
      ...parsed.data,
      namespaceKey: namespace.key,
    }
    const result = previewUiResourceSync(backoffice, targetedManifest)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setCandidateManifest(targetedManifest)
    setSelectedResourceKeys(
      new Set(targetedManifest.resources.map((resource) => resource.key)),
    )
    setGrantAdministratorAccess(true)
    setPreview(result.value)
    setError(undefined)
  }

  function changeReviewSelection(resourceKey: string, checked: boolean) {
    if (!candidateManifest) return
    const nextKeys = new Set(selectedResourceKeys)
    if (checked) {
      let currentKey: string | null = resourceKey
      while (currentKey) {
        nextKeys.add(currentKey)
        currentKey =
          candidateManifest.resources.find(
            (resource) => resource.key === currentKey,
          )?.parentKey ?? null
      }
    } else {
      for (const resource of candidateManifest.resources) {
        if (
          resource.key === resourceKey ||
          resource.key.startsWith(`${resourceKey}:`)
        ) {
          nextKeys.delete(resource.key)
        }
      }
    }
    if (nextKeys.size === 0) {
      setError("invalid-input")
      return
    }

    const selectedManifest = {
      ...candidateManifest,
      resources: candidateManifest.resources.filter((resource) =>
        nextKeys.has(resource.key),
      ),
    }
    const nextPreview = previewUiResourceSync(backoffice, selectedManifest)
    if (!nextPreview.ok) {
      setError(nextPreview.error)
      return
    }
    setSelectedResourceKeys(nextKeys)
    setPreview(nextPreview.value)
    setError(undefined)
  }

  async function synchronize() {
    const requesterId = sessionAccess.currentUser?.id
    if (!requesterId || !preview) {
      setError("ui-resource-import-forbidden")
      return
    }
    const result = await backoffice.importUiResources(
      {
        manifest: preview.manifest,
        grantAdministratorAccess,
      },
      requesterId,
    )
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(
      t("imported", {
        added: result.value.addedCount,
        updated: result.value.updatedCount,
        orphaned: result.value.orphanedCount,
      }),
    )
    setResult(result.value)
    setSelectedOrphanIds(
      new Set(result.value.orphanedResources.map((resource) => resource.id)),
    )
    setError(undefined)
  }

  const administratorRole = preview
    ? backoffice.roles.find(
        (role) => role.id === preview.namespace.administratorRoleId,
      )
    : undefined
  if (preview && !administratorRole) {
    throw new Error(
      `UI Namespace administrator role not found: ${preview.namespace.administratorRoleId}`,
    )
  }

  async function removeSynchronizedOrphans() {
    const requesterId = sessionAccess.currentUser?.id
    if (!requesterId || !result || selectedOrphanIds.size === 0) return
    const removal = await backoffice.deleteOrphanedUiResources(
      [...selectedOrphanIds],
      requesterId,
    )
    if (!removal.ok) {
      setError(removal.error)
      return
    }
    const removedIds = new Set(removal.value.map((resource) => resource.id))
    const remaining = result.orphanedResources.filter(
      (resource) => !removedIds.has(resource.id),
    )
    setResult({
      ...result,
      orphanedCount: remaining.length,
      orphanedResources: remaining,
    })
    setSelectedOrphanIds(new Set())
    snackbar.success(t("orphansRemoved", { count: removal.value.length }))
  }

  return (
    <FormDialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger
        render={
          <Button
            data-ui-resource={
              uiResourceKeys.uiResources.list.actions.importUiResources
            }
          />
        }
      >
        <Plus aria-hidden />
        {t("add")}
      </DialogTrigger>
      <FormDialogContent className="max-h-[min(90svh,52rem)] max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("add")}</DialogTitle>
          <DialogDescription>{t("addDescription")}</DialogDescription>
        </DialogHeader>
        <form
          id={formId}
          className="grid min-h-0 gap-4 overflow-y-auto pr-1 md:grid-rows-[auto_minmax(0,1fr)_auto] md:overflow-hidden md:pr-0"
          onSubmit={(event) => {
            event.preventDefault()
            if (result) return
            if (preview) void synchronize()
            else review()
          }}
        >
          <ol className="grid grid-cols-3 gap-2" aria-label={t("progress")}>
            {[t("inputStep"), t("reviewStep"), t("completeStep")].map(
              (label, index) => {
                const stage = result ? 2 : preview ? 1 : 0
                const active = index === stage
                const complete = index < stage
                return (
                  <li
                    key={label}
                    aria-current={active ? "step" : undefined}
                    className="flex items-center gap-2 rounded-control border px-3 py-2 text-sm"
                  >
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                        active || complete
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-text-subtle"
                      }`}
                    >
                      {complete ? <Check className="size-3.5" /> : index + 1}
                    </span>
                    {label}
                  </li>
                )
              },
            )}
          </ol>
          <div
            className={
              result || preview
                ? "min-h-0 md:overflow-hidden"
                : "min-h-0 overflow-y-auto pr-1"
            }
          >
            {result ? (
              <UiResourceSyncCompletion
                result={result}
                selectedIds={selectedOrphanIds}
                onSelectedIdsChange={setSelectedOrphanIds}
              />
            ) : preview && candidateManifest ? (
              <UiResourceSyncReview
                preview={preview}
                manifest={candidateManifest}
                selectedKeys={selectedResourceKeys}
                onSelectionChange={changeReviewSelection}
                administratorRoleName={administratorRole?.name ?? ""}
                grantAdministratorAccess={grantAdministratorAccess}
                onGrantAdministratorAccessChange={setGrantAdministratorAccess}
              />
            ) : (
              <div className="grid gap-4">
                <FormSelect
                  label={t("namespace")}
                  value={namespaceId}
                  onValueChange={(value) => {
                    setNamespaceId(value)
                    setError(undefined)
                  }}
                  options={namespaces.map((namespace) => ({
                    value: namespace.id,
                    label: `${namespace.name} (${namespace.key})`,
                  }))}
                />
                <FieldDescription>{t("namespaceDescription")}</FieldDescription>
                <FormSelect
                  label={t("format")}
                  value={format}
                  onValueChange={(value) => {
                    if (value) setFormat(value)
                    setError(undefined)
                  }}
                  options={[
                    { value: "yaml", label: "YAML" },
                    { value: "json", label: "JSON" },
                  ]}
                />
                <Field>
                  <FieldLabel htmlFor="ui-resource-manifest">
                    {t("manifest")}
                  </FieldLabel>
                  <Textarea
                    id="ui-resource-manifest"
                    name="manifest"
                    className="h-72 max-h-72 resize-none overflow-y-auto font-mono text-xs"
                    value={source}
                    required
                    spellCheck={false}
                    autoCapitalize="none"
                    aria-invalid={error === "invalid-input"}
                    aria-describedby="ui-resource-manifest-description"
                    onChange={(event) => {
                      setSource(event.currentTarget.value)
                      setError(undefined)
                    }}
                  />
                  <FieldDescription id="ui-resource-manifest-description">
                    {t("manifestDescription")}
                  </FieldDescription>
                </Field>
              </div>
            )}
          </div>
          <CommandErrorMessage error={error} />
        </form>
        <DialogFooter>
          {result ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false)
                }}
              >
                {t("finish")}
              </Button>
              {result.orphanedResources.length > 0 ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={selectedOrphanIds.size === 0}
                  onClick={removeSynchronizedOrphans}
                >
                  {t("deleteSelected", { count: selectedOrphanIds.size })}
                </Button>
              ) : null}
            </>
          ) : (
            <>
              {preview ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPreview(undefined)
                    setCandidateManifest(undefined)
                    setSelectedResourceKeys(new Set())
                    setError(undefined)
                  }}
                >
                  {common("previous")}
                </Button>
              ) : (
                <DialogClose
                  render={<Button type="button" variant="outline" />}
                >
                  {common("cancel")}
                </DialogClose>
              )}
              <Button
                type="submit"
                form={formId}
                disabled={!preview && (!namespaceId || !source.trim())}
              >
                {t(preview ? "import" : "review")}
              </Button>
            </>
          )}
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}

function UiResourceSyncCompletion({
  result,
  selectedIds,
  onSelectedIdsChange,
}: {
  result: UiResourceImportResult
  selectedIds: Set<string>
  onSelectedIdsChange: (ids: Set<string>) => void
}) {
  const t = useTranslations("backoffice.uiResources")

  return (
    <section
      className="grid gap-4 md:h-full md:min-h-0 md:grid-rows-[auto_minmax(0,1fr)] md:overflow-hidden"
      aria-labelledby="ui-resource-complete-title"
    >
      <div className="grid gap-1">
        <h3 id="ui-resource-complete-title" className="font-semibold">
          {t("completeTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("completeDescription", {
            added: result.addedCount,
            updated: result.updatedCount,
            orphaned: result.orphanedResources.length,
          })}
        </p>
        <p className="text-sm font-medium text-foreground">
          {t(
            result.administratorAccessUpdated
              ? "completeAdministratorGranted"
              : "completeAdministratorUnchanged",
          )}
        </p>
      </div>
      {result.orphanedResources.length > 0 ? (
        <div className="grid gap-2 md:min-h-0 md:grid-rows-[auto_minmax(0,1fr)_auto]">
          <p className="text-sm font-medium">{t("selectOrphansToDelete")}</p>
          <ul
            className="grid max-h-72 gap-1 overflow-y-auto rounded-card border p-2 md:max-h-none md:min-h-0"
            aria-label={t("selectOrphansToDelete")}
          >
            {result.orphanedResources.map((resource) => (
              <li key={resource.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-control bg-surface-subtle px-3 py-2">
                  <Checkbox
                    checked={selectedIds.has(resource.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedIds)
                      if (checked) next.add(resource.id)
                      else next.delete(resource.id)
                      onSelectedIdsChange(next)
                    }}
                  />
                  <span className="grid min-w-0 gap-0.5">
                    <code className="truncate text-xs font-semibold">
                      {resource.key}
                    </code>
                    <span className="truncate text-caption text-text-subtle">
                      {resource.name}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            {t("orphanRetentionDescription")}
          </p>
        </div>
      ) : (
        <p className="rounded-control bg-success/10 px-3 py-2 text-sm text-success-foreground">
          {t("completeWithoutOrphans")}
        </p>
      )}
    </section>
  )
}

function UiResourceSyncReview({
  preview,
  manifest,
  selectedKeys,
  onSelectionChange,
  administratorRoleName,
  grantAdministratorAccess,
  onGrantAdministratorAccessChange,
}: {
  preview: UiResourceSyncPreview
  manifest: UiResourceManifest
  selectedKeys: Set<string>
  onSelectionChange: (resourceKey: string, checked: boolean) => void
  administratorRoleName: string
  grantAdministratorAccess: boolean
  onGrantAdministratorAccessChange: (checked: boolean) => void
}) {
  const t = useTranslations("backoffice.uiResources")
  const sortedResources = useMemo(
    () =>
      [...manifest.resources].sort((left, right) =>
        left.key.localeCompare(right.key, "en"),
      ),
    [manifest.resources],
  )
  const groups = [
    {
      key: "added",
      title: t("reviewAdded", { count: preview.added.length }),
      resources: preview.added,
    },
    {
      key: "updated",
      title: t("reviewUpdated", { count: preview.updated.length }),
      resources: preview.updated.map(({ next }) => next),
    },
    {
      key: "restored",
      title: t("reviewRestored", { count: preview.restored.length }),
      resources: preview.restored.map(({ next }) => next),
    },
    {
      key: "orphaned",
      title: t("reviewOrphaned", { count: preview.orphaned.length }),
      resources: preview.orphaned,
    },
  ]

  return (
    <section
      className="grid gap-4 md:h-full md:min-h-0 md:grid-rows-[auto_minmax(0,1fr)] md:overflow-hidden"
      aria-labelledby="ui-resource-review-title"
    >
      <div className="grid gap-1">
        <h3 id="ui-resource-review-title" className="font-semibold">
          {t("reviewTitle", { namespace: preview.namespace.name })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("reviewDescription")}
        </p>
        <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-control border border-brand/30 bg-brand-weak px-3 py-2.5">
          <Checkbox
            checked={grantAdministratorAccess}
            onCheckedChange={onGrantAdministratorAccessChange}
          />
          <span className="grid min-w-0 gap-0.5">
            <span className="text-sm font-semibold">
              {t("grantAdministratorAccess", {
                role: administratorRoleName,
              })}
            </span>
            <span className="text-caption text-text-subtle">
              {t("grantAdministratorAccessDescription")}
            </span>
          </span>
        </label>
      </div>
      <div className="grid gap-3 md:min-h-0 md:grid-rows-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="grid gap-2 rounded-card border p-3 md:min-h-0 md:grid-rows-[auto_minmax(0,1fr)]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="grid gap-1">
              <h4 className="text-sm font-semibold">
                {t("reviewSelectionTitle")}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t("reviewSelectionDescription")}
              </p>
            </div>
            <Badge variant="secondary">
              {t("selectedSyncCount", { count: selectedKeys.size })}
            </Badge>
          </div>
          <ul
            className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2 md:max-h-none md:min-h-0"
            aria-label={t("reviewSelectionTitle")}
          >
            {sortedResources.map((resource) => (
              <li key={resource.key}>
                <label className="flex cursor-pointer items-start gap-3 rounded-control bg-surface-subtle px-3 py-2">
                  <Checkbox
                    checked={selectedKeys.has(resource.key)}
                    onCheckedChange={(checked) => {
                      onSelectionChange(resource.key, checked)
                    }}
                  />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <code className="truncate text-xs font-semibold">
                        {resource.key}
                      </code>
                      <UiResourceTypeBadge type={resource.type} />
                    </span>
                    <span className="truncate text-caption text-text-subtle">
                      {resource.name}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
        <div className="grid gap-3 md:min-h-0 md:grid-cols-4">
          {groups.map((group) => (
            <section
              key={group.key}
              className="grid gap-2 rounded-card border p-3 md:min-h-0 md:grid-rows-[auto_minmax(0,1fr)]"
            >
              <h4 className="text-sm font-semibold">{group.title}</h4>
              {group.resources.length > 0 ? (
                <ul
                  className="grid max-h-56 gap-1 overflow-y-auto md:max-h-none md:min-h-0"
                  aria-label={group.title}
                >
                  {group.resources.map((resource) => (
                    <li
                      key={resource.key}
                      className="grid gap-0.5 rounded-control bg-surface-subtle px-2 py-1.5"
                    >
                      <code className="truncate text-xs" title={resource.key}>
                        {resource.key}
                      </code>
                      <span className="truncate text-caption text-text-subtle">
                        {resource.name}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("reviewEmpty")}
                </p>
              )}
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}

function OrphanedUiResourceCleanupDialog({
  resources,
}: {
  resources: UiResource[]
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.uiResources")
  const common = useTranslations("backoffice.common")
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<BackofficeErrorCode>()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  async function remove() {
    const requesterId = sessionAccess.currentUser?.id
    if (!requesterId) {
      setError("ui-resource-delete-forbidden")
      return
    }
    const result = await backoffice.deleteOrphanedUiResources(
      [...selectedIds],
      requesterId,
    )
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t("orphansRemoved", { count: result.value.length }))
    setOpen(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        setSelectedIds(new Set(resources.map((resource) => resource.id)))
        setError(undefined)
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            data-ui-resource={
              uiResourceKeys.uiResources.list.actions.deleteUiResources
            }
          />
        }
      >
        <Trash2 aria-hidden />
        {t("cleanup", { count: resources.length })}
      </DialogTrigger>
      <FormDialogContent>
        <DialogHeader>
          <DialogTitle>{t("cleanupTitle")}</DialogTitle>
          <DialogDescription>{t("cleanupDescription")}</DialogDescription>
        </DialogHeader>
        <ul className="grid max-h-72 gap-2 overflow-y-auto rounded-control border p-2">
          {resources.map((resource) => {
            const namespace = backoffice.uiNamespaces.find(
              (item) => item.id === resource.namespaceId,
            )
            if (!namespace) {
              throw new Error(
                `Orphaned UI Resource namespace not found: ${resource.namespaceId}`,
              )
            }
            return (
              <li key={resource.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-control bg-surface-subtle px-3 py-2">
                  <Checkbox
                    checked={selectedIds.has(resource.id)}
                    onCheckedChange={(checked) => {
                      setSelectedIds((current) => {
                        const next = new Set(current)
                        if (checked) next.add(resource.id)
                        else next.delete(resource.id)
                        return next
                      })
                    }}
                  />
                  <span className="grid min-w-0 gap-0.5">
                    <code className="truncate text-xs font-semibold">
                      {resource.key}
                    </code>
                    <span className="truncate text-caption text-text-subtle">
                      {namespace.name} · {resource.name}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        <CommandErrorMessage error={error} />
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {common("cancel")}
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={selectedIds.size === 0}
            onClick={remove}
          >
            {t("deleteSelected", { count: selectedIds.size })}
          </Button>
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}

function UiResourcesTable({
  data,
  canChangeStatus,
}: {
  data: UiResource[]
  canChangeStatus: boolean
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.uiResources")
  const common = useTranslations("backoffice.common")
  const errorsT = useTranslations("backoffice.errors")
  const visibilities = useMemo(
    () => resolveUiResourceVisibilities(data),
    [data],
  )

  const changeStatus = useCallback(
    async (resource: UiResource, status: UiResource["status"]) => {
      const requesterId = sessionAccess.currentUser?.id
      if (!requesterId) return
      const result = await backoffice.setUiResourceStatus(
        resource.id,
        status,
        requesterId,
      )
      if (!result.ok) {
        snackbar.error(errorsT(result.error))
        return
      }
      snackbar.success(t("statusChanged"))
    },
    [backoffice, errorsT, sessionAccess.currentUser?.id, t],
  )

  const columns = useMemo<ColumnDef<UiResource>[]>(
    () => [
      {
        accessorKey: "key",
        header: t("key"),
        size: 280,
        cell: ({ row }) => (
          <code className="block truncate" title={row.original.key}>
            {row.original.key}
          </code>
        ),
      },
      {
        id: "namespace",
        header: t("namespace"),
        size: 170,
        cell: ({ row }) => {
          const namespace = backoffice.uiNamespaces.find(
            (item) => item.id === row.original.namespaceId,
          )
          if (!namespace) {
            throw new Error(
              `UI Resource namespace not found: ${row.original.namespaceId}`,
            )
          }
          return namespace.name
        },
      },
      { accessorKey: "name", header: common("name"), size: 180 },
      {
        accessorKey: "type",
        header: t("type"),
        size: 110,
        cell: ({ row }) => <UiResourceTypeBadge type={row.original.type} />,
      },
      {
        id: "visibility",
        header: t("visibility"),
        size: 190,
        cell: ({ row }) => {
          const visibility =
            visibilities.get(row.original.id) ?? "ancestor-inactive"
          return (
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  visibility === "visible"
                    ? "success"
                    : visibility === "inactive"
                      ? "secondary"
                      : "warning"
                }
              >
                {t(`visibilityStates.${visibility}`)}
              </Badge>
              {canChangeStatus ? (
                <span
                  data-ui-resource={
                    uiResourceKeys.uiResources.list.actions
                      .changeUiResourceStatus
                  }
                >
                  <StatusSwitch
                    status={row.original.status}
                    label={t("statusLabel", { name: row.original.name })}
                    disabled={row.original.orphanedAt !== null}
                    onChange={(status) => {
                      void changeStatus(row.original, status)
                    }}
                  />
                </span>
              ) : null}
            </div>
          )
        },
      },
      {
        accessorKey: "parentKey",
        header: t("parentKey"),
        size: 200,
        cell: ({ row }) =>
          row.original.parentKey ? (
            <code className="block truncate" title={row.original.parentKey}>
              {row.original.parentKey}
            </code>
          ) : (
            t("root")
          ),
      },
    ],
    [
      backoffice.uiNamespaces,
      canChangeStatus,
      changeStatus,
      common,
      t,
      visibilities,
    ],
  )

  return (
    <DataTable
      caption={t("tableCaption")}
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      empty={t("empty")}
      filterLabel={common("search")}
      noResults={common("noResults")}
      filters={[
        { id: "key", label: t("key"), getValue: (row) => row.key },
        {
          id: "namespace",
          label: t("namespace"),
          getValue: (row) =>
            backoffice.uiNamespaces.find((item) => item.id === row.namespaceId)
              ?.name ?? "",
        },
        { id: "name", label: common("name"), getValue: (row) => row.name },
        {
          id: "type",
          label: t("type"),
          getValue: (row) => t(`types.${row.type}`),
        },
        {
          id: "visibility",
          label: t("visibility"),
          getValue: (row) =>
            t(
              `visibilityStates.${visibilities.get(row.id) ?? "ancestor-inactive"}`,
            ),
        },
        {
          id: "parentKey",
          label: t("parentKey"),
          getValue: (row) => row.parentKey ?? t("root"),
        },
      ]}
    />
  )
}

export function UiResourcesPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const t = useTranslations("backoffice.uiResources")
  const access = sessionAccess.currentUser
    ? resolveUiResourceAccess(backoffice, sessionAccess.currentUser.id)
    : null
  const manageableNamespaceIds = new Set(access?.manageableNamespaceIds ?? [])
  const visibleNamespaces = backoffice.uiNamespaces.filter((namespace) =>
    manageableNamespaceIds.has(namespace.id),
  )
  const visibleResources = backoffice.uiResources.filter((resource) =>
    manageableNamespaceIds.has(resource.namespaceId),
  )
  const canImport =
    sessionAccess.canAccessUiResource(
      uiResourceKeys.uiResources.list.actions.importUiResources,
    ) &&
    Boolean(
      sessionAccess.currentUser &&
      hasEffectiveAccessPolicyResource(
        backoffice,
        sessionAccess.currentUser.id,
        {
          type: "endpoint",
          id: backoffice.systemReferences.serviceEndpointIds.importUiResources,
        },
      ),
    ) &&
    visibleNamespaces.length > 0
  const canDelete = sessionAccess.canAccessUiResource(
    uiResourceKeys.uiResources.list.actions.deleteUiResources,
  )
  const canChangeStatus = sessionAccess.canAccessUiResource(
    uiResourceKeys.uiResources.list.actions.changeUiResourceStatus,
  )
  const orphanedResources = visibleResources.filter(
    (resource) => resource.orphanedAt !== null,
  )
  return (
    <div
      className="grid gap-6"
      data-ui-resource={uiResourceKeys.uiResources.list.key}
    >
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          canImport || (canDelete && orphanedResources.length > 0) ? (
            <>
              {canDelete && orphanedResources.length > 0 ? (
                <OrphanedUiResourceCleanupDialog
                  resources={orphanedResources}
                />
              ) : null}
              {canImport ? (
                <UiResourceImportDialog namespaces={visibleNamespaces} />
              ) : null}
            </>
          ) : null
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={Boxes}
          title={t("total")}
          value={visibleResources.length}
        />
        <MetricCard
          icon={Layers3}
          title={t("namespaceCount")}
          value={visibleNamespaces.length}
        />
        <MetricCard
          icon={orphanedResources.length > 0 ? TriangleAlert : Boxes}
          title={t("orphanedCount")}
          value={orphanedResources.length}
        />
      </div>
      <UiResourcesTable
        data={visibleResources}
        canChangeStatus={canChangeStatus}
      />
    </div>
  )
}
