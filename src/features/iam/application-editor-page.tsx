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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import type { BackofficeErrorCode } from "@/domain/common"
import {
  applicationInputSchema,
  type ApplicationInput,
} from "@/features/iam/model"

export function ApplicationEditorPage({
  applicationId,
}: {
  applicationId?: string
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.applications")
  const application = applicationId
    ? backoffice.applications.find((item) => item.id === applicationId)
    : undefined
  const [step, setStep] = useState<ReviewWorkflowStep>(1)
  const [name, setName] = useState(application?.name ?? "")
  const [slug, setSlug] = useState(application?.slug ?? "")
  const [description, setDescription] = useState(application?.description ?? "")
  const [ownerOrganizationId, setOwnerOrganizationId] = useState<string | null>(
    application?.ownerOrganizationId ?? backoffice.organizations[0]?.id ?? null,
  )
  const [error, setError] = useState<BackofficeErrorCode>()

  if (applicationId && !application) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          <Button nativeButton={false} render={<Link href="/applications" />}>
            {common("backToList")}
          </Button>
        }
      />
    )
  }

  if (backoffice.organizations.length === 0) {
    return (
      <EmptyState
        title={t(application ? "edit" : "add")}
        description={t("organizationRequired")}
        action={
          <Button
            nativeButton={false}
            render={<Link href="/organizations/new" />}
          >
            {t("createOrganization")}
          </Button>
        }
      />
    )
  }

  const parsed = applicationInputSchema.safeParse({
    name,
    slug,
    description,
    ownerOrganizationId,
  })
  const owner = backoffice.organizations.find(
    (item) => item.id === ownerOrganizationId,
  )

  async function submit() {
    const nextInput = applicationInputSchema.safeParse({
      name,
      slug,
      description,
      ownerOrganizationId,
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
    const result = application
      ? await backoffice.updateApplication(
          application.id,
          nextInput.data satisfies ApplicationInput,
          requesterId,
        )
      : await backoffice.createApplication(
          nextInput.data satisfies ApplicationInput,
          requesterId,
        )
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t(application ? "updated" : "created"))
    router.replace(`/applications/${result.value.id}`)
  }

  return (
    <RequestWorkflow
      title={t(application ? "edit" : "add")}
      description={t(application ? "editDescription" : "addDescription")}
      cancelLabel={common("cancel")}
      cancelHref={
        application ? `/applications/${application.id}` : "/applications"
      }
      previousLabel={step === 2 ? common("previous") : undefined}
      submitLabel={
        step === 1 ? common("next") : common(application ? "save" : "create")
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
            <FieldLabel htmlFor="application-editor-name">
              {t("name")}
            </FieldLabel>
            <Input
              id="application-editor-name"
              value={name}
              required
              minLength={2}
              maxLength={100}
              onChange={(event) => {
                setName(event.currentTarget.value)
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="application-editor-slug">
              {t("slug")}
            </FieldLabel>
            <Input
              id="application-editor-slug"
              value={slug}
              required
              minLength={2}
              maxLength={64}
              pattern="[a-z][a-z0-9]*(?:_[a-z0-9]+)*"
              autoCapitalize="none"
              spellCheck={false}
              readOnly={Boolean(application)}
              onChange={(event) => {
                setSlug(event.currentTarget.value)
              }}
            />
            <FieldDescription>{t("slugDescription")}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="application-editor-description">
              {t("applicationDescription")}
            </FieldLabel>
            <Textarea
              id="application-editor-description"
              value={description}
              required
              minLength={2}
              maxLength={500}
              rows={6}
              onChange={(event) => {
                setDescription(event.currentTarget.value)
              }}
            />
          </Field>
          <FormSelect
            label={t("ownerOrganization")}
            value={ownerOrganizationId}
            onValueChange={setOwnerOrganizationId}
            options={backoffice.organizations.map((organization) => ({
              value: organization.id,
              label: organization.name,
            }))}
          />
        </div>
      ) : (
        <section className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="text-base font-semibold">{common("reviewTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {common("reviewDescription")}
            </p>
          </div>
          <DetailGrid>
            <DetailItem label={t("name")}>{name.trim()}</DetailItem>
            <DetailItem label={t("slug")}>
              <code>{slug.trim()}</code>
            </DetailItem>
            <DetailItem label={t("ownerOrganization")}>
              {owner?.name ?? common("none")}
            </DetailItem>
            <DetailItem label={t("applicationDescription")}>
              <span className="whitespace-pre-wrap">{description.trim()}</span>
            </DetailItem>
          </DetailGrid>
        </section>
      )}
      <CommandErrorMessage error={error} />
    </RequestWorkflow>
  )
}
