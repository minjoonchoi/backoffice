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
  namespaceInputSchema,
  type NamespaceInput,
} from "@/features/ui-resources/model"

export function NamespaceEditorPage({ namespaceId }: { namespaceId?: string }) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.namespaces")
  const namespace = namespaceId
    ? backoffice.namespaces.find((item) => item.id === namespaceId)
    : undefined
  const [step, setStep] = useState<ReviewWorkflowStep>(1)
  const [key, setKey] = useState(namespace?.key ?? "")
  const [name, setName] = useState(namespace?.name ?? "")
  const [description, setDescription] = useState(namespace?.description ?? "")
  const [managerRoleId, setManagerRoleId] = useState<string | null>(
    namespace?.managerRoleId ?? null,
  )
  const [error, setError] = useState<BackofficeErrorCode>()
  const inputResult = namespaceInputSchema.safeParse({
    key,
    name,
    description,
    managerRoleId,
  })
  const validation = useDynamicFormValidation(
    inputResult.success ? undefined : inputResult.error,
  )
  const keyValidation = validation.getFieldValidation(
    "key",
    "namespace-editor-key-error",
  )
  const nameValidation = validation.getFieldValidation(
    "name",
    "namespace-editor-name-error",
  )
  const descriptionValidation = validation.getFieldValidation(
    "description",
    "namespace-editor-description-error",
  )
  const managerRoleValidation = validation.getFieldValidation(
    "managerRoleId",
    "namespace-editor-manager-role-error",
  )

  if (namespaceId && !namespace) {
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

  if (backoffice.roles.length === 0) {
    return (
      <EmptyState
        title={t(namespace ? "changeManagerTitle" : "add")}
        description={t("roleRequired")}
        action={
          <Button nativeButton={false} render={<Link href="/roles/new" />}>
            {t("createRole")}
          </Button>
        }
      />
    )
  }

  const parsed = namespace
    ? managerRoleId !== null && managerRoleId !== namespace.managerRoleId
    : inputResult.success
  const managerRole = backoffice.roles.find((role) => role.id === managerRoleId)

  async function submit() {
    if (!managerRoleId) {
      validation.revealAll()
      return
    }
    const createInput = namespaceInputSchema.safeParse({
      key,
      name,
      description,
      managerRoleId,
    })
    if (!namespace && !createInput.success) {
      validation.revealAll()
      if (step === 2) setStep(1)
      return
    }
    if (step === 1) {
      setError(undefined)
      setStep(2)
      return
    }
    const requesterId = sessionAccess.currentUser?.id
    if (!requesterId) {
      setError("namespace-operation-forbidden")
      return
    }
    let result
    if (namespace) {
      result = await backoffice.updateNamespaceManager(
        namespace.id,
        managerRoleId,
        requesterId,
      )
    } else {
      if (!createInput.success) {
        setError("invalid-input")
        setStep(1)
        return
      }
      result = await backoffice.createNamespace(
        createInput.data satisfies NamespaceInput,
        requesterId,
      )
    }
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t(namespace ? "managerUpdated" : "created"))
    router.replace(`/namespaces/${result.value.id}`)
  }

  return (
    <RequestWorkflow
      noValidate
      title={t(namespace ? "changeManagerTitle" : "add")}
      description={t(namespace ? "changeManagerDescription" : "addDescription")}
      cancelLabel={common("cancel")}
      cancelHref={namespace ? `/namespaces/${namespace.id}` : "/namespaces"}
      previousLabel={step === 2 ? common("previous") : undefined}
      submitLabel={
        step === 1 ? common("next") : common(namespace ? "save" : "create")
      }
      submitDisabled={namespace ? !parsed : false}
      onPrevious={() => {
        setStep(1)
        setError(undefined)
      }}
      onSubmit={() => void submit()}
    >
      <ReviewWorkflowProgress step={step} label={common("editorProgress")} />
      {step === 1 ? (
        <div className="grid gap-4">
          {!namespace ? (
            <>
              <Field invalid={keyValidation.invalid}>
                <FieldLabel htmlFor="namespace-editor-key">
                  {t("key")}
                </FieldLabel>
                <Input
                  id="namespace-editor-key"
                  value={key}
                  required
                  minLength={2}
                  maxLength={60}
                  pattern="[a-z][a-z0-9]*(?:-[a-z0-9]+)*"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={keyValidation.invalid}
                  aria-describedby={keyValidation.errorId}
                  onChange={(event) => {
                    validation.touch("key")
                    setKey(event.currentTarget.value)
                  }}
                />
                <FieldDescription>{t("keyDescription")}</FieldDescription>
                <FieldValidationMessage validation={keyValidation} />
              </Field>
              <Field invalid={nameValidation.invalid}>
                <FieldLabel htmlFor="namespace-editor-name">
                  {common("name")}
                </FieldLabel>
                <Input
                  id="namespace-editor-name"
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
              <Field invalid={descriptionValidation.invalid}>
                <FieldLabel htmlFor="namespace-editor-description">
                  {t("namespaceDescription")}
                </FieldLabel>
                <Textarea
                  id="namespace-editor-description"
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
            </>
          ) : null}
          <FormSelect
            label={t("managerRole")}
            value={managerRoleId}
            onValueChange={setManagerRoleId}
            onInteract={() => {
              validation.touch("managerRoleId")
            }}
            error={managerRoleValidation.error}
            options={[...backoffice.roles]
              .sort((left, right) => left.name.localeCompare(right.name, "ko"))
              .map((role) => ({ value: role.id, label: role.name }))}
          />
          <FieldDescription>{t("managerRoleDescription")}</FieldDescription>
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
            {!namespace ? (
              <>
                <DetailItem label={t("key")}>
                  <code>{key.trim()}</code>
                </DetailItem>
                <DetailItem label={common("name")}>{name.trim()}</DetailItem>
                <DetailItem label={t("namespaceDescription")}>
                  <span className="whitespace-pre-wrap">
                    {description.trim()}
                  </span>
                </DetailItem>
              </>
            ) : null}
            <DetailItem label={t("managerRole")}>
              {managerRole?.name ?? common("none")}
            </DetailItem>
          </DetailGrid>
        </section>
      )}
      <CommandErrorMessage error={error} />
    </RequestWorkflow>
  )
}
