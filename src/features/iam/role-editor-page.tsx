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
import { RequestWorkflow } from "@/components/patterns/request-workflow"
import {
  ReviewWorkflowProgress,
  type ReviewWorkflowStep,
} from "@/components/patterns/review-workflow-progress"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import type { BackofficeErrorCode } from "@/domain/common"
import { isSystemRole } from "@/domain/system-references"
import { roleInputSchema, type RoleInput } from "@/features/iam/model"

export function RoleEditorPage({ roleId }: { roleId?: string }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.roles")
  const role = roleId
    ? backoffice.roles.find((item) => item.id === roleId)
    : undefined
  const [step, setStep] = useState<ReviewWorkflowStep>(1)
  const [name, setName] = useState(role?.name ?? "")
  const [description, setDescription] = useState(role?.description ?? "")
  const [error, setError] = useState<BackofficeErrorCode>()
  const parsed = roleInputSchema.safeParse({ name, description })
  const validation = useDynamicFormValidation(
    parsed.success ? undefined : parsed.error,
  )
  const nameValidation = validation.getFieldValidation(
    "name",
    "role-editor-name-error",
  )
  const descriptionValidation = validation.getFieldValidation(
    "description",
    "role-editor-description-error",
  )

  if (roleId && !role) {
    return (
      <EmptyState
        title={t("detailTitle")}
        description={t("notFound")}
        action={
          <Button nativeButton={false} render={<Link href="/roles" />}>
            {common("backToList")}
          </Button>
        }
      />
    )
  }

  if (role && isSystemRole(backoffice.systemReferences, role.id)) {
    return (
      <EmptyState
        title={t("edit")}
        description={t("systemRoleEditUnavailable")}
        action={
          <Button
            nativeButton={false}
            render={<Link href={`/roles/${role.id}`} />}
          >
            {common("backToList")}
          </Button>
        }
      />
    )
  }

  async function submit() {
    const nextInput = roleInputSchema.safeParse({ name, description })
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
    const result = role
      ? await backoffice.updateRole(
          role.id,
          nextInput.data satisfies RoleInput,
          requesterId,
        )
      : await backoffice.createRole(
          nextInput.data satisfies RoleInput,
          requesterId,
        )
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t(role ? "updated" : "created"))
    router.replace(`/roles/${result.value.id}`)
  }

  return (
    <RequestWorkflow
      noValidate
      title={t(role ? "edit" : "add")}
      description={t(role ? "editDescription" : "addDescription")}
      cancelLabel={common("cancel")}
      cancelHref={role ? `/roles/${role.id}` : "/roles"}
      previousLabel={step === 2 ? common("previous") : undefined}
      submitLabel={
        step === 1 ? common("next") : common(role ? "save" : "create")
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
            <FieldLabel htmlFor="role-editor-name">{t("roleName")}</FieldLabel>
            <Input
              id="role-editor-name"
              value={name}
              required
              minLength={2}
              maxLength={80}
              aria-invalid={nameValidation.invalid}
              aria-describedby={nameValidation.errorId}
              onChange={(event) => {
                validation.touch("name")
                setName(event.currentTarget.value)
              }}
            />
            <FieldValidationMessage validation={nameValidation} />
          </Field>
          <Field invalid={descriptionValidation.invalid}>
            <FieldLabel htmlFor="role-editor-description">
              {t("roleDescription")}
            </FieldLabel>
            <Textarea
              id="role-editor-description"
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
            <DetailItem label={t("roleName")}>{name.trim()}</DetailItem>
            <DetailItem label={t("roleDescription")}>
              <span className="whitespace-pre-wrap">{description.trim()}</span>
            </DetailItem>
          </DetailGrid>
        </section>
      )}
      <CommandErrorMessage error={error} />
    </RequestWorkflow>
  )
}
