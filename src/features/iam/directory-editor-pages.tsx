"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { useBackoffice } from "@/application/state/provider"
import { CommandErrorMessage } from "@/application/ui/backoffice-ui"
import { useSessionAccess } from "@/auth/session-access-provider"
import { EmptyState } from "@/components/patterns/content-state"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import { FormSelect } from "@/components/patterns/form-select"
import { RequestWorkflow } from "@/components/patterns/request-workflow"
import {
  ReviewWorkflowProgress,
  type ReviewWorkflowStep,
} from "@/components/patterns/review-workflow-progress"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import type { BackofficeErrorCode } from "@/domain/common"
import {
  employmentStatuses,
  employmentStatusValues,
  organizationInputSchema,
  userInputSchema,
  type EmploymentStatus,
  type Organization,
  type OrganizationInput,
  type UserInput,
} from "@/features/iam/model"

const rootOrganizationValue = "root"

function isDescendant(
  organizations: readonly Organization[],
  candidateId: string,
  organizationId: string,
) {
  let current = organizations.find((item) => item.id === candidateId)
  while (current?.parentId) {
    if (current.parentId === organizationId) return true
    current = organizations.find((item) => item.id === current?.parentId)
  }
  return false
}

function ReviewHeader() {
  const common = useTranslations("backoffice.common")
  return (
    <div className="grid gap-1">
      <h2 className="text-base font-semibold">{common("reviewTitle")}</h2>
      <p className="text-sm text-muted-foreground">
        {common("reviewDescription")}
      </p>
    </div>
  )
}

export function UserEditorPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.users")
  const employmentT = useTranslations("backoffice.employmentStatuses")
  const [step, setStep] = useState<ReviewWorkflowStep>(1)
  const [nickname, setNickname] = useState("")
  const [email, setEmail] = useState("")
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>(
    employmentStatusValues.employed,
  )
  const [organizationIds, setOrganizationIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<BackofficeErrorCode>()

  function parseInput() {
    return userInputSchema.safeParse({
      nickname,
      email,
      employmentStatus,
      organizationIds: [...organizationIds],
    })
  }

  async function submit() {
    const parsed = parseInput()
    if (!parsed.success) {
      setError("invalid-input")
      if (step === 2) setStep(1)
      return
    }
    if (step === 1) {
      setError(undefined)
      setStep(2)
      return
    }
    const result = await backoffice.createUser(
      parsed.data satisfies UserInput,
      sessionAccess.currentUser?.id ?? "",
    )
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t("created"))
    router.replace(`/users/${result.value.id}`)
  }

  const selectedOrganizations = backoffice.organizations.filter((item) =>
    organizationIds.has(item.id),
  )

  return (
    <RequestWorkflow
      title={t("add")}
      description={t("addDescription")}
      cancelLabel={common("cancel")}
      cancelHref="/users"
      previousLabel={step === 2 ? common("previous") : undefined}
      submitLabel={step === 1 ? common("next") : common("create")}
      submitDisabled={!parseInput().success}
      onPrevious={() => {
        setStep(1)
        setError(undefined)
      }}
      onSubmit={() => void submit()}
    >
      <ReviewWorkflowProgress step={step} label={common("editorProgress")} />
      {step === 1 ? (
        <div className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="user-create-nickname">
              {t("nickname")}
            </FieldLabel>
            <Input
              id="user-create-nickname"
              value={nickname}
              required
              minLength={2}
              maxLength={40}
              onChange={(event) => {
                setNickname(event.currentTarget.value)
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="user-create-email">{t("email")}</FieldLabel>
            <Input
              id="user-create-email"
              value={email}
              type="email"
              required
              maxLength={160}
              onChange={(event) => {
                setEmail(event.currentTarget.value)
              }}
            />
          </Field>
          <FormSelect
            label={t("employmentStatus")}
            value={employmentStatus}
            onValueChange={(value) => {
              if (value) setEmploymentStatus(value)
            }}
            options={employmentStatuses.map((status) => ({
              value: status,
              label: employmentT(status),
            }))}
          />
          <fieldset className="grid gap-2 rounded-card border p-3">
            <legend className="px-1 text-sm font-medium">
              {t("organizations")}
            </legend>
            {backoffice.organizations.length > 0 ? (
              <div className="grid gap-1 sm:grid-cols-2">
                {backoffice.organizations.map((organization) => (
                  <label
                    key={organization.id}
                    className="flex min-h-control items-center gap-2 rounded-control px-2 hover:bg-surface-subtle"
                  >
                    <Checkbox
                      checked={organizationIds.has(organization.id)}
                      onCheckedChange={(checked) => {
                        setOrganizationIds((current) => {
                          const next = new Set(current)
                          if (checked) next.add(organization.id)
                          else next.delete(organization.id)
                          return next
                        })
                      }}
                    />
                    <span>{organization.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("unassigned")}</p>
            )}
          </fieldset>
        </div>
      ) : (
        <section className="grid gap-4">
          <ReviewHeader />
          <DetailGrid>
            <DetailItem label={t("nickname")}>{nickname.trim()}</DetailItem>
            <DetailItem label={t("email")}>{email.trim()}</DetailItem>
            <DetailItem label={t("employmentStatus")}>
              {employmentT(employmentStatus)}
            </DetailItem>
            <DetailItem label={t("organizations")}>
              {selectedOrganizations.length > 0
                ? selectedOrganizations.map((item) => item.name).join(", ")
                : common("none")}
            </DetailItem>
          </DetailGrid>
        </section>
      )}
      <CommandErrorMessage error={error} />
    </RequestWorkflow>
  )
}

export function OrganizationEditorPage({
  organizationId,
}: {
  organizationId?: string
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.organizations")
  const organization = organizationId
    ? backoffice.organizations.find((item) => item.id === organizationId)
    : undefined
  const [step, setStep] = useState<ReviewWorkflowStep>(1)
  const [name, setName] = useState(organization?.name ?? "")
  const [leaderUserId, setLeaderUserId] = useState<string | null>(
    organization?.leaderUserId ?? null,
  )
  const [parentId, setParentId] = useState<string | null>(
    organization?.parentId ?? null,
  )
  const [error, setError] = useState<BackofficeErrorCode>()

  if (organizationId && !organization) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          <Button nativeButton={false} render={<Link href="/organizations" />}>
            {common("backToList")}
          </Button>
        }
      />
    )
  }

  const employedUsers = backoffice.users.filter(
    (user) => user.employmentStatus === employmentStatusValues.employed,
  )
  if (!organization && employedUsers.length === 0) {
    return (
      <EmptyState
        title={t("add")}
        description={t("userRequired")}
        action={
          <Button nativeButton={false} render={<Link href="/users/new" />}>
            {t("createUser")}
          </Button>
        }
      />
    )
  }

  const parentCandidates = backoffice.organizations.filter(
    (candidate) =>
      candidate.id !== organization?.id &&
      (!organization ||
        !isDescendant(backoffice.organizations, candidate.id, organization.id)),
  )
  const parsed = organizationInputSchema.safeParse({
    name,
    leaderUserId,
    ...(parentId ? { parentId } : {}),
  })
  const leader = backoffice.users.find((user) => user.id === leaderUserId)
  const parent = backoffice.organizations.find((item) => item.id === parentId)

  async function submit() {
    const nextInput = organizationInputSchema.safeParse({
      name,
      leaderUserId,
      ...(parentId ? { parentId } : {}),
    })
    if (!nextInput.success) {
      setError("invalid-input")
      if (step === 2) setStep(1)
      return
    }
    if (step === 1) {
      setError(undefined)
      setStep(2)
      return
    }
    const requesterId = sessionAccess.currentUser?.id ?? ""
    const result = organization
      ? await backoffice.updateOrganization(
          organization.id,
          nextInput.data satisfies OrganizationInput,
          requesterId,
        )
      : await backoffice.createOrganization(
          nextInput.data satisfies OrganizationInput,
          requesterId,
        )
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t(organization ? "updated" : "created"))
    router.replace(`/organizations/${result.value.id}`)
  }

  return (
    <RequestWorkflow
      title={t(organization ? "edit" : "add")}
      description={t(organization ? "editDescription" : "addDescription")}
      cancelLabel={common("cancel")}
      cancelHref={
        organization ? `/organizations/${organization.id}` : "/organizations"
      }
      previousLabel={step === 2 ? common("previous") : undefined}
      submitLabel={
        step === 1 ? common("next") : common(organization ? "save" : "create")
      }
      submitDisabled={!parsed.success}
      onPrevious={() => {
        setStep(1)
        setError(undefined)
      }}
      onSubmit={() => void submit()}
    >
      <ReviewWorkflowProgress step={step} label={common("editorProgress")} />
      {step === 1 ? (
        <div className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="organization-editor-name">
              {t("organizationName")}
            </FieldLabel>
            <Input
              id="organization-editor-name"
              value={name}
              required
              minLength={2}
              maxLength={80}
              onChange={(event) => {
                setName(event.currentTarget.value)
              }}
            />
          </Field>
          <FormSelect
            label={t("leader")}
            value={leaderUserId}
            onValueChange={setLeaderUserId}
            options={employedUsers.map((user) => ({
              value: user.id,
              label: user.nickname,
            }))}
          />
          <FormSelect
            label={t("parent")}
            value={parentId ?? rootOrganizationValue}
            onValueChange={(value) => {
              setParentId(value === rootOrganizationValue ? null : value)
            }}
            options={[
              { value: rootOrganizationValue, label: t("noParent") },
              ...parentCandidates.map((candidate) => ({
                value: candidate.id,
                label: candidate.name,
              })),
            ]}
          />
        </div>
      ) : (
        <section className="grid gap-4">
          <ReviewHeader />
          <DetailGrid>
            <DetailItem label={t("organizationName")}>{name.trim()}</DetailItem>
            <DetailItem label={t("leader")}>
              {leader?.nickname ?? common("none")}
            </DetailItem>
            <DetailItem label={t("parent")}>
              {parent?.name ?? t("noParent")}
            </DetailItem>
          </DetailGrid>
        </section>
      )}
      <CommandErrorMessage error={error} />
    </RequestWorkflow>
  )
}
