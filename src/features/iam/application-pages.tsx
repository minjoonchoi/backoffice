"use client"

import { entityStatuses } from "@/domain/common"
import type { ColumnDef } from "@tanstack/react-table"
import { AppWindow, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { useBackoffice } from "@/application/state/provider"
import {
  CommandErrorMessage,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"
import { ConfirmAction } from "@/components/patterns/confirm-action"
import { DataTable } from "@/components/patterns/data-table"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import { EmptyState } from "@/components/patterns/content-state"
import {
  FormDialog,
  FormDialogContent,
} from "@/components/patterns/form-dialog"
import { MetricCard } from "@/components/patterns/metric-card"
import { PageHeader } from "@/components/patterns/page-header"
import { Badge } from "@/components/ui/badge"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import { uiResourceKeys } from "@/config/menu-registry"
import type { BackofficeErrorCode } from "@/domain/common"
import { applicationInputSchema, type Application } from "@/features/iam/model"
import type { ApiKey } from "@/features/credentials/model"
import { accessPolicyAssignmentTargets } from "@/features/access-policies/model"

function ApplicationFormDialog({ application }: { application?: Application }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.applications")
  const [open, setOpen] = useState(false)
  const [ownerOrganizationId, setOwnerOrganizationId] = useState(
    application?.ownerOrganizationId ?? backoffice.organizations[0]?.id ?? "",
  )
  const [error, setError] = useState<BackofficeErrorCode>()
  const formId = application
    ? "application-update-form"
    : "application-create-form"

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const parsed = applicationInputSchema.safeParse({
      name: data.get("name"),
      slug: data.get("slug"),
      description: data.get("description"),
      ownerOrganizationId,
    })
    if (!parsed.success) {
      setError("invalid-input")
      return
    }
    const requesterId = sessionAccess.currentUser?.id ?? ""
    const result = application
      ? await backoffice.updateApplication(
          application.id,
          parsed.data,
          requesterId,
        )
      : await backoffice.createApplication(parsed.data, requesterId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t(application ? "updated" : "created"))
    setError(undefined)
    setOpen(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) {
          setOwnerOrganizationId(
            application?.ownerOrganizationId ??
              backoffice.organizations[0]?.id ??
              "",
          )
        }
        setError(undefined)
      }}
    >
      <DialogTrigger
        render={<Button variant={application ? "outline" : "default"} />}
      >
        {application ? <Pencil /> : <Plus />}
        {t(application ? "edit" : "add")}
      </DialogTrigger>
      <FormDialogContent>
        <DialogHeader>
          <DialogTitle>{t(application ? "edit" : "add")}</DialogTitle>
          <DialogDescription>
            {t(application ? "editDescription" : "addDescription")}
          </DialogDescription>
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
            <FieldLabel htmlFor={`${formId}-name`}>{t("name")}</FieldLabel>
            <Input
              id={`${formId}-name`}
              name="name"
              defaultValue={application?.name}
              required
              minLength={2}
              maxLength={100}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-slug`}>{t("slug")}</FieldLabel>
            <Input
              id={`${formId}-slug`}
              name="slug"
              defaultValue={application?.slug}
              required
              minLength={2}
              maxLength={64}
              pattern="[a-z][a-z0-9]*(?:_[a-z0-9]+)*"
              autoCapitalize="none"
              spellCheck={false}
              readOnly={Boolean(application)}
            />
            <FieldDescription>{t("slugDescription")}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-description`}>
              {t("applicationDescription")}
            </FieldLabel>
            <Textarea
              id={`${formId}-description`}
              name="description"
              defaultValue={application?.description}
              required
              minLength={2}
              maxLength={500}
              rows={4}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-owner`}>
              {t("ownerOrganization")}
            </FieldLabel>
            <Select
              value={ownerOrganizationId}
              items={backoffice.organizations.map((organization) => ({
                value: organization.id,
                label: organization.name,
              }))}
              onValueChange={(value) => {
                if (value) setOwnerOrganizationId(value)
              }}
            >
              <SelectTrigger id={`${formId}-owner`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {backoffice.organizations.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <CommandErrorMessage error={error} />
        </form>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {common("cancel")}
          </DialogClose>
          <Button type="submit" form={formId}>
            {application ? common("save") : common("create")}
          </Button>
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}

export function ApplicationsPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.applications")
  const labels = useBackofficeLabels()
  const canCreate = sessionAccess.canAccessUiResource(
    uiResourceKeys.applications.list.actions.createApplication,
  )
  const canViewDetail = sessionAccess.canAccessUiResource(
    uiResourceKeys.applications.detail.key,
  )
  const columns = useMemo<ColumnDef<Application>[]>(
    () => [
      { accessorKey: "name", header: t("name") },
      { accessorKey: "slug", header: t("slug") },
      {
        id: "ownerOrganization",
        header: t("ownerOrganization"),
        cell: ({ row }) =>
          backoffice.organizations.find(
            (organization) =>
              organization.id === row.original.ownerOrganizationId,
          )?.name ?? common("none"),
      },
      { accessorKey: "description", header: t("applicationDescription") },
      {
        accessorKey: "createdAt",
        header: common("createdAt"),
        cell: ({ row }) => labels.dateTime(row.original.createdAt),
      },
    ],
    [backoffice.organizations, common, labels, t],
  )

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={canCreate ? <ApplicationFormDialog /> : undefined}
      />
      <MetricCard
        icon={AppWindow}
        title={t("total")}
        value={backoffice.applications.length}
      />
      <DataTable
        caption={t("tableCaption")}
        columns={columns}
        data={backoffice.applications}
        getRowId={(row) => row.id}
        getRowHref={(row) =>
          canViewDetail ? `/applications/${row.id}` : undefined
        }
        getRowLabel={(row) => `${row.name} ${common("details")}`}
        empty={t("empty")}
        filterLabel={common("search")}
        noResults={common("noResults")}
        filters={[
          { id: "name", label: t("name"), getValue: (row) => row.name },
          { id: "slug", label: t("slug"), getValue: (row) => row.slug },
          {
            id: "owner",
            label: t("ownerOrganization"),
            getValue: (row) =>
              backoffice.organizations.find(
                (organization) => organization.id === row.ownerOrganizationId,
              )?.name ?? "",
          },
        ]}
      />
    </div>
  )
}

export function ApplicationDetailPage({
  applicationId,
}: {
  applicationId: string
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.applications")
  const credentialsT = useTranslations("backoffice.apiKeys")
  const application = backoffice.applications.find(
    (item) => item.id === applicationId,
  )

  if (!application) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          <Button render={<Link href="/applications" />}>
            {common("backToList")}
          </Button>
        }
      />
    )
  }

  const ownerOrganization = backoffice.organizations.find(
    (organization) => organization.id === application.ownerOrganizationId,
  )
  const credentials = backoffice.apiKeys.filter(
    (credential) => credential.applicationId === application.id,
  )
  const assignments = backoffice.accessPolicyAssignments.filter(
    (assignment) =>
      assignment.targetType === accessPolicyAssignmentTargets.application &&
      assignment.targetId === application.id,
  )
  const policies = assignments.flatMap((assignment) => {
    const policy = backoffice.accessPolicies.find(
      (candidate) => candidate.id === assignment.accessPolicyId,
    )
    return policy ? [policy] : []
  })
  const credentialColumns: ColumnDef<ApiKey>[] = [
    { accessorKey: "name", header: credentialsT("keyName") },
    {
      id: "service",
      header: credentialsT("service"),
      cell: ({ row }) =>
        backoffice.services.find(
          (service) => service.id === row.original.serviceId,
        )?.name ?? common("none"),
    },
    {
      id: "status",
      header: common("status"),
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === entityStatuses.active
              ? "success"
              : "secondary"
          }
        >
          {common(row.original.status)}
        </Badge>
      ),
    },
  ]

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={application.name}
        description={t("detailDescription")}
        actions={
          <>
            {sessionAccess.canAccessUiResource(
              uiResourceKeys.applications.detail.actions.updateApplication,
            ) ? (
              <ApplicationFormDialog application={application} />
            ) : null}
            {sessionAccess.canAccessUiResource(
              uiResourceKeys.applications.detail.actions.deleteApplication,
            ) ? (
              <ConfirmAction
                trigger={
                  <>
                    <Trash2 />
                    {common("delete")}
                  </>
                }
                title={t("deleteTitle", { name: application.name })}
                description={t("deleteDescription")}
                confirmLabel={common("delete")}
                cancelLabel={common("cancel")}
                onConfirm={async () => {
                  const result = await backoffice.deleteApplication(
                    application.id,
                    sessionAccess.currentUser?.id ?? "",
                  )
                  if (!result.ok) return
                  snackbar.success(t("deleted"))
                  router.push("/applications")
                }}
              />
            ) : null}
          </>
        }
      />
      <DetailGrid>
        <DetailItem label={t("name")}>{application.name}</DetailItem>
        <DetailItem label={t("slug")}>
          <code>{application.slug}</code>
        </DetailItem>
        <DetailItem label={t("ownerOrganization")}>
          {ownerOrganization ? (
            <Link
              className="text-primary hover:underline"
              href={`/organizations/${ownerOrganization.id}`}
            >
              {ownerOrganization.name}
            </Link>
          ) : (
            common("none")
          )}
        </DetailItem>
        <DetailItem
          label={t("applicationDescription")}
          className="sm:col-span-2"
        >
          {application.description}
        </DetailItem>
      </DetailGrid>
      <DataTable
        caption={t("credentialsCaption")}
        columns={credentialColumns}
        data={credentials}
        getRowId={(row) => row.id}
        getRowHref={(row) => `/credentials/${row.id}`}
        getRowLabel={(row) => `${row.name} ${common("details")}`}
        empty={t("credentialsEmpty")}
        filterLabel={common("search")}
        noResults={common("noResults")}
        filters={[
          {
            id: "credential",
            label: credentialsT("keyName"),
            getValue: (row) => row.name,
          },
        ]}
      />
      <DataTable
        caption={t("policiesCaption")}
        columns={[
          { accessorKey: "name", header: t("policyName") },
          {
            id: "managementType",
            header: t("managementType"),
            cell: ({ row }) => (
              <Badge variant="info">
                {t(`managementTypes.${row.original.managementType}`)}
              </Badge>
            ),
          },
        ]}
        data={policies}
        getRowId={(row) => row.id}
        getRowHref={(row) => `/approval-documents/${row.id}`}
        getRowLabel={(row) => `${row.name} ${common("details")}`}
        empty={t("policiesEmpty")}
        filterLabel={common("search")}
        noResults={common("noResults")}
        filters={[
          { id: "policy", label: t("policyName"), getValue: (row) => row.name },
        ]}
      />
    </div>
  )
}
