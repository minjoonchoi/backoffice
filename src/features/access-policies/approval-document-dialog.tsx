"use client"

import { ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { RequestDialog } from "@/components/patterns/request-dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import {
  accessPolicyResourceNames,
  resolveAccessPolicyResourceGroups,
  resolveAccessPolicyUiNamespaces,
  resolveAccessPolicyUiResources,
} from "@/features/access-policies/access-policy-resources"
import { resolveMissingAccessPolicyResources } from "@/features/access-policies/access-policy-assignment"
import { approvalDocumentInputSchema } from "@/features/access-policies/model"
import { FormSelect } from "@/components/patterns/form-select"
import type { AccessPolicy } from "@/features/access-policies/model"
import type {
  ApprovalLine,
  ApprovalStep,
} from "@/features/request-templates/model"
import { resolveRequestOrganizationLeader } from "@/features/request-templates/approval-assignee"
import type { BackofficeErrorCode } from "@/domain/common"
import { useBackoffice } from "@/application/state/provider"
import {
  AccessPolicyEffectBadge,
  CommandErrorMessage,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

type RequestStep = 1 | 2 | 3

export type ApprovalDocumentDialogProps = {
  policy: AccessPolicy
  approvalLine: ApprovalLine
  triggerLabel?: string
}

export function ApprovalDocumentDialog({
  policy,
  approvalLine,
  triggerLabel,
}: ApprovalDocumentDialogProps) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const common = useTranslations("backoffice.common")
  const documentsT = useTranslations("backoffice.approvalDocuments")
  const labels = useBackofficeLabels()
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState("")
  const [requesterId, setRequesterId] = useState<string | null>(null)
  const [requestOrganizationId, setRequestOrganizationId] = useState<
    string | null
  >(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [error, setError] = useState<BackofficeErrorCode>()
  const [requestStep, setRequestStep] = useState<RequestStep>(1)

  if (
    policy.status !== "active" ||
    approvalLine.status !== "active" ||
    approvalLine.category !== "permission" ||
    policy.type !== approvalLine.type
  ) {
    throw new TypeError(`Access policy approval line not found: ${policy.id}`)
  }

  const policyResourceGroups = resolveAccessPolicyResourceGroups(
    backoffice,
    policy,
  )
  const policyUiNamespaces = resolveAccessPolicyUiNamespaces(backoffice, policy)
  const policyUiResources = resolveAccessPolicyUiResources(backoffice, policy)
  const missingResourceCount = sessionAccess.currentUser
    ? resolveMissingAccessPolicyResources(
        backoffice,
        sessionAccess.currentUser.id,
        policy,
      ).length
    : policy.resources.length
  const users = backoffice.users.filter(
    (item) =>
      item.employmentStatus === "employed" &&
      requestOrganizationId !== null &&
      item.organizationIds.includes(requestOrganizationId),
  )
  const requester = backoffice.users.find((item) => item.id === requesterId)
  const requestOrganization = backoffice.organizations.find(
    (item) => item.id === requestOrganizationId,
  )
  const requestOrganizationLeader = resolveRequestOrganizationLeader(
    backoffice,
    requestOrganizationId,
    requesterId,
  )
  const assignmentsComplete = approvalLine.steps.every(
    (step) =>
      (step.assigneeMode !== "document-select" ||
        Boolean(assignments[step.id])) &&
      (step.assigneeMode !== "request-organization-leader" ||
        Boolean(requestOrganizationLeader)),
  )

  function resetDependentValues() {
    setContent("")
    setRequesterId(null)
    setRequestOrganizationId(null)
    setAssignments({})
    setError(undefined)
    setRequestStep(1)
  }

  function reset() {
    resetDependentValues()
  }

  function resolveStepLabel(step: ApprovalStep) {
    switch (step.assigneeMode) {
      case "fixed-user":
        return backoffice.users.find((user) => user.id === step.userId)
          ?.nickname
      case "fixed-organization":
        return backoffice.organizations.find(
          (organization) => organization.id === step.organizationId,
        )?.name
      case "document-select":
        return labels.assigneeMode(step.assigneeMode)
      case "requester":
        return requester?.nickname
      case "request-organization-leader":
        return requestOrganizationLeader?.leader.nickname
      case "request-organization":
        return requestOrganization?.name
      case "service-owner-organization":
        return labels.assigneeMode(step.assigneeMode)
    }
  }

  async function submit(form: HTMLFormElement) {
    if (requestStep < 3) {
      setError(undefined)
      setRequestStep((current) => (current === 1 ? 2 : 3))
      return
    }

    const parsed = approvalDocumentInputSchema.safeParse({
      documentKind: "general",
      title: documentsT("policyDocumentTitle", { policy: policy.name }),
      type: "access-grant",
      organizationId: requestOrganizationId,
      requesterId,
      approvalLineId: approvalLine.id,
      accessPolicyId: policy.id,
      content,
      fieldValues: [],
      stepAssignments: Object.entries(assignments).map(([stepId, userId]) => ({
        stepId,
        userId,
      })),
      submission: "submitted",
    })
    if (!parsed.success) {
      setError("invalid-input")
      return
    }
    const result = await backoffice.createApprovalDocument(parsed.data)
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(documentsT("submitted"))
    setOpen(false)
    form.reset()
    reset()
  }

  const requestSteps = [
    documentsT("requestSteps.target"),
    documentsT("requestSteps.reason"),
    documentsT("requestSteps.review"),
  ]
  const currentRequestStepLabel =
    requestStep === 1
      ? documentsT("requestSteps.target")
      : requestStep === 2
        ? documentsT("requestSteps.reason")
        : documentsT("requestSteps.review")
  const targetComplete = Boolean(requesterId && requestOrganizationId)
  const reasonComplete = content.trim().length >= 10 && assignmentsComplete
  const submitDisabled =
    (requestStep === 1 && !targetComplete) ||
    (requestStep === 2 && !reasonComplete) ||
    (requestStep === 3 && (!targetComplete || !reasonComplete))

  const policySummary = (
    <div className="grid gap-3 rounded-lg border bg-surface-subtle p-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          {documentsT("selectedPolicy")}
        </p>
        <p className="mt-1 font-semibold">{policy.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {policy.description}
        </p>
        <p className="mt-2 text-sm font-medium">
          {documentsT("requestResourceCoverage", {
            owned: policy.resources.length - missingResourceCount,
            missing: missingResourceCount,
          })}
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">
            {documentsT("effect")}
          </dt>
          <dd className="mt-1">
            <AccessPolicyEffectBadge effect={policy.effect} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            {documentsT("resources")}
          </dt>
          <dd className="mt-1 text-sm">
            {accessPolicyResourceNames(backoffice, policy)}
          </dd>
        </div>
      </dl>
    </div>
  )

  const processingFlow = (
    <section className="grid gap-2" aria-label={documentsT("preview")}>
      {approvalLine.steps.map((step) => (
        <div key={step.id} className="grid gap-2 rounded-lg border p-3">
          <div>
            <span className="mr-2 font-semibold">{step.order}</span>
            {labels.stepKind(step.kind)} ·{" "}
            {labels.assigneeMode(step.assigneeMode)}
          </div>
          {requestStep === 2 && step.assigneeMode === "document-select" ? (
            <FormSelect
              label={documentsT("stepAssignee")}
              value={assignments[step.id] ?? null}
              onValueChange={(value) => {
                setAssignments((current) =>
                  value
                    ? { ...current, [step.id]: value }
                    : Object.fromEntries(
                        Object.entries(current).filter(
                          ([id]) => id !== step.id,
                        ),
                      ),
                )
              }}
              options={users.map((user) => ({
                value: user.id,
                label: user.nickname,
              }))}
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              {step.assigneeMode === "document-select"
                ? backoffice.users.find(
                    (user) => user.id === assignments[step.id],
                  )?.nickname
                : (resolveStepLabel(step) ??
                  labels.assigneeMode(step.assigneeMode))}
            </span>
          )}
        </div>
      ))}
    </section>
  )

  return (
    <RequestDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) reset()
      }}
      triggerLabel={triggerLabel ?? documentsT("requestFromList")}
      triggerIcon={ShieldCheck}
      title={documentsT("policyRequestTitle")}
      description={documentsT("policyRequestDescription")}
      cancelLabel={common("cancel")}
      {...(requestStep > 1
        ? {
            previousLabel: common("previous"),
            onPrevious: () => {
              setError(undefined)
              setRequestStep((current) => (current === 3 ? 2 : 1))
            },
          }
        : {})}
      submitLabel={requestStep < 3 ? common("next") : documentsT("submit")}
      submitDisabled={submitDisabled}
      onSubmit={submit}
    >
      <div className="grid gap-2" aria-label={documentsT("requestStepLabel")}>
        <ol className="grid grid-cols-3 gap-2">
          {requestSteps.map((label, index) => {
            const step = index + 1
            const current = step === requestStep
            const complete = step < requestStep
            return (
              <li
                key={label}
                className="grid min-w-0 justify-items-center gap-1 text-center"
                aria-current={current ? "step" : undefined}
              >
                <span
                  className={`grid size-7 place-items-center rounded-full border text-xs font-semibold ${
                    current
                      ? "border-primary bg-primary text-primary-foreground"
                      : complete
                        ? "border-brand bg-brand-weak text-brand-weak-foreground"
                        : "border-border bg-surface text-muted-foreground"
                  }`}
                >
                  {step}
                </span>
                <span className="hidden text-xs font-medium sm:block">
                  {label}
                </span>
              </li>
            )
          })}
        </ol>
        <p className="text-center text-sm font-medium">
          {documentsT("requestStepProgress", {
            current: requestStep,
            total: requestSteps.length,
            label: currentRequestStepLabel,
          })}
        </p>
      </div>

      {requestStep === 1 ? (
        <section className="grid gap-4" aria-labelledby="request-target-title">
          <div className="grid gap-1">
            <h3 id="request-target-title" className="text-base font-semibold">
              {documentsT("requestTargetTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {documentsT("requestTargetDescription")}
            </p>
          </div>
          {policySummary}
          <div className="grid gap-4">
            <FormSelect
              label={documentsT("requester")}
              value={requesterId}
              onValueChange={(value) => {
                setRequesterId(value)
                const selected = backoffice.users.find(
                  (user) => user.id === value,
                )
                setRequestOrganizationId(selected?.organizationIds[0] ?? null)
                setAssignments({})
              }}
              options={backoffice.users
                .filter((user) => user.employmentStatus === "employed")
                .map((user) => ({ value: user.id, label: user.nickname }))}
            />
            <FormSelect
              label={documentsT("requestOrganization")}
              value={requestOrganizationId}
              onValueChange={(value) => {
                setRequestOrganizationId(value)
                setAssignments({})
              }}
              disabled={!requester}
              options={backoffice.organizations
                .filter((organization) =>
                  requester?.organizationIds.includes(organization.id),
                )
                .map((organization) => ({
                  value: organization.id,
                  label: organization.name,
                }))}
            />
          </div>
        </section>
      ) : null}

      {requestStep === 2 ? (
        <section className="grid gap-4" aria-labelledby="request-reason-title">
          <div className="grid gap-1">
            <h3 id="request-reason-title" className="text-base font-semibold">
              {documentsT("requestReasonTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {documentsT("requestReasonDescription")}
            </p>
          </div>
          <Field>
            <FieldLabel htmlFor="approval-content">
              {documentsT("content")}
            </FieldLabel>
            <Textarea
              id="approval-content"
              name="content"
              required
              minLength={10}
              maxLength={5000}
              value={content}
              onChange={(event) => {
                setContent(event.target.value)
              }}
            />
          </Field>
          <div className="grid gap-2">
            <h4 className="text-sm font-semibold">
              {documentsT("approvalFlow")}
            </h4>
            {processingFlow}
          </div>
        </section>
      ) : null}

      {requestStep === 3 ? (
        <section className="grid gap-4" aria-labelledby="request-review-title">
          <div className="grid gap-1">
            <h3 id="request-review-title" className="text-base font-semibold">
              {documentsT("requestReviewTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {documentsT("requestReviewDescription")}
            </p>
          </div>
          {policySummary}
          <dl className="grid overflow-hidden rounded-lg border sm:grid-cols-2">
            <div className="grid content-start gap-1 border-b p-4 sm:border-r">
              <dt className="text-xs text-muted-foreground">
                {documentsT("requester")}
              </dt>
              <dd className="font-medium">{requester?.nickname}</dd>
            </div>
            <div className="grid content-start gap-1 border-b p-4">
              <dt className="text-xs text-muted-foreground">
                {documentsT("requestOrganization")}
              </dt>
              <dd className="font-medium">{requestOrganization?.name}</dd>
            </div>
            <div className="grid content-start gap-1 p-4 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">
                {documentsT("content")}
              </dt>
              <dd className="whitespace-pre-wrap">{content}</dd>
            </div>
          </dl>
          {policyResourceGroups.length > 0 ? (
            <section
              aria-labelledby="policy-resource-title"
              className="grid gap-2"
            >
              <h4 id="policy-resource-title" className="text-sm font-medium">
                {documentsT("resources")}
              </h4>
              <ul className="grid max-h-60 gap-2 overflow-y-auto">
                {policyResourceGroups.map(({ service, endpoints }) => (
                  <li
                    key={service.id}
                    className="grid gap-2 rounded-lg border px-3 py-2"
                  >
                    <p className="text-sm font-medium">{service.name}</p>
                    <ul className="grid gap-1 text-sm text-muted-foreground">
                      {endpoints.map(({ endpoint }) => (
                        <li key={endpoint.id}>
                          {endpoint.method} {endpoint.path}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {policyUiResources.length > 0 ? (
            <section
              aria-labelledby="policy-ui-resource-title"
              className="grid gap-2"
            >
              <h4 id="policy-ui-resource-title" className="text-sm font-medium">
                {documentsT("uiResources")}
              </h4>
              <ul className="grid max-h-60 gap-2 overflow-y-auto">
                {policyUiResources.map(({ namespace, resource }) => (
                  <li key={resource.id} className="rounded-lg border px-3 py-2">
                    <p className="text-sm font-medium">{resource.name}</p>
                    <code className="text-xs text-text-subtle">
                      {namespace.name} · {resource.key}
                    </code>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {policyUiNamespaces.length > 0 ? (
            <section
              aria-labelledby="policy-ui-namespace-title"
              className="grid gap-2"
            >
              <h4
                id="policy-ui-namespace-title"
                className="text-sm font-medium"
              >
                {documentsT("resourceTypeLabels.ui-namespace")}
              </h4>
              <ul className="grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">
                {policyUiNamespaces.map((namespace) => (
                  <li
                    key={namespace.id}
                    className="grid gap-1 rounded-lg border px-3 py-2"
                  >
                    <p className="text-sm font-medium">{namespace.name}</p>
                    <code className="text-xs text-text-subtle">
                      {namespace.key}
                    </code>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <div className="grid gap-2">
            <h4 className="text-sm font-semibold">
              {documentsT("approvalFlow")}
            </h4>
            {processingFlow}
          </div>
        </section>
      ) : null}
      <CommandErrorMessage error={error} />
    </RequestDialog>
  )
}
