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
import {
  FieldValidationMessage,
  useDynamicFormValidation,
} from "@/components/patterns/dynamic-form-validation"
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
  applicationKeyInputPattern,
  applicationInputSchema,
  filterApplicationKeyInput,
  type ApplicationInput,
} from "@/features/iam/model"
import { resolveApplicationResourceAccess } from "@/features/iam/application-access"
import { uiResourceKeys } from "@/config/menu-registry"

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
  const applicationAccess = resolveApplicationResourceAccess(
    backoffice,
    sessionAccess.currentUser?.id ?? null,
  )
  const application = applicationId
    ? applicationAccess.applications.find((item) => item.id === applicationId)
    : undefined
  const [step, setStep] = useState<ReviewWorkflowStep>(1)
  const [name, setName] = useState(application?.name ?? "")
  const [applicationKey, setApplicationKey] = useState(
    application?.applicationKey ?? "",
  )
  const [description, setDescription] = useState(application?.description ?? "")
  const [ownerOrganizationId, setOwnerOrganizationId] = useState<string | null>(
    application?.ownerOrganizationId ??
      applicationAccess.ownerOrganizations[0]?.id ??
      null,
  )
  const [error, setError] = useState<BackofficeErrorCode>()
  const parsed = applicationInputSchema.safeParse({
    name,
    applicationKey,
    description,
    ownerOrganizationId,
  })
  const validation = useDynamicFormValidation(
    parsed.success ? undefined : parsed.error,
  )
  const nameValidation = validation.getFieldValidation(
    "name",
    "application-editor-name-error",
  )
  const applicationKeyValidation = validation.getFieldValidation(
    "applicationKey",
    "application-editor-application-key-error",
  )
  const descriptionValidation = validation.getFieldValidation(
    "description",
    "application-editor-description-error",
  )
  const ownerValidation = validation.getFieldValidation(
    "ownerOrganizationId",
    "application-editor-owner-error",
  )

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

  if (applicationAccess.ownerOrganizations.length === 0) {
    return (
      <EmptyState
        title={t(application ? "edit" : "add")}
        description={t("organizationRequired")}
        action={
          sessionAccess.canAccessUiResource(
            uiResourceKeys.organizations.list.actions.createOrganization,
          ) ? (
            <Button
              nativeButton={false}
              render={<Link href="/organizations/new" />}
            >
              {t("createOrganization")}
            </Button>
          ) : undefined
        }
      />
    )
  }

  const owner = applicationAccess.ownerOrganizations.find(
    (item) => item.id === ownerOrganizationId,
  )

  async function submit() {
    const nextInput = applicationInputSchema.safeParse({
      name,
      applicationKey,
      description,
      ownerOrganizationId,
    })
    if (!nextInput.success) {
      validation.revealAll()
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
      noValidate
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
      onPrevious={() => {
        setStep(1)
        setError(undefined)
      }}
      onSubmit={() => void submit()}
    >
      <ReviewWorkflowProgress step={step} label={common("editorProgress")} />
      {step === 1 ? (
        <div className="grid gap-4">
          <Field invalid={nameValidation.invalid}>
            <FieldLabel htmlFor="application-editor-name">
              {t("name")}
            </FieldLabel>
            <Input
              id="application-editor-name"
              value={name}
              required
              minLength={2}
              maxLength={100}
              aria-invalid={nameValidation.invalid}
              aria-describedby={nameValidation.errorId}
              onChange={(event) => {
                validation.touch("name")
                setName(event.currentTarget.value)
              }}
            />
            <FieldValidationMessage validation={nameValidation} />
          </Field>
          <Field invalid={applicationKeyValidation.invalid}>
            <FieldLabel htmlFor="application-editor-application-key">
              {t("applicationKey")}
            </FieldLabel>
            <Input
              id="application-editor-application-key"
              value={applicationKey}
              required
              minLength={2}
              maxLength={64}
              pattern={applicationKeyInputPattern}
              autoCapitalize="none"
              spellCheck={false}
              readOnly={Boolean(application)}
              aria-invalid={applicationKeyValidation.invalid}
              aria-describedby={applicationKeyValidation.errorId}
              onChange={(event) => {
                validation.touch("applicationKey")
                setApplicationKey(
                  filterApplicationKeyInput(event.currentTarget.value),
                )
              }}
            />
            <FieldDescription>
              {t("applicationKeyDescription")}
            </FieldDescription>
            <FieldValidationMessage validation={applicationKeyValidation} />
          </Field>
          <Field invalid={descriptionValidation.invalid}>
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
              aria-invalid={descriptionValidation.invalid}
              aria-describedby={descriptionValidation.errorId}
              onChange={(event) => {
                validation.touch("description")
                setDescription(event.currentTarget.value)
              }}
            />
            <FieldValidationMessage validation={descriptionValidation} />
          </Field>
          <FormSelect
            label={t("ownerOrganization")}
            value={ownerOrganizationId}
            onValueChange={setOwnerOrganizationId}
            onInteract={() => {
              validation.touch("ownerOrganizationId")
            }}
            error={ownerValidation.error}
            options={applicationAccess.ownerOrganizations.map(
              (organization) => ({
                value: organization.id,
                label: organization.name,
              }),
            )}
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
            <DetailItem label={t("applicationKey")}>
              <code>{applicationKey.trim()}</code>
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
