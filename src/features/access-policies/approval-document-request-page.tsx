"use client"

import {
  accessPolicyTypes,
  approvalDocumentKinds,
  approvalDocumentSubmissions,
  type ApprovalDocumentSubmission,
} from "@/features/access-policies/model"
import { requestCategoryValues } from "@/features/request-templates/model"
import { employmentStatusValues } from "@/features/iam/model"
import { entityStatuses } from "@/domain/common"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { EmptyState } from "@/components/patterns/content-state"
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
import {
  accessPolicyResourceNames,
  resolveAccessPolicyResourceGroups,
  resolveAccessPolicyUiResources,
} from "@/features/access-policies/access-policy-resources"
import { resolveMissingAccessPolicyResources } from "@/features/access-policies/access-policy-assignment"
import { resolveAccessPolicyApprovalLine } from "@/features/access-policies/access-policy-template"
import { approvalDocumentInputSchema } from "@/features/access-policies/model"
import { FormSelect } from "@/components/patterns/form-select"
import {
  accessPolicyManagementTypes,
  type AccessPolicy,
} from "@/features/access-policies/model"
import type { ApprovalLine } from "@/features/request-templates/model"
import { RequestApprovalLineEditor } from "@/features/request-templates/request-approval-line-editor"
import {
  createRequestApprovalLineDraft,
  requestApprovalLineDraftIsComplete,
  toRequestApprovalStepInputs,
  type RequestApprovalStepDraft,
} from "@/features/request-templates/request-approval-line"
import type { BackofficeErrorCode } from "@/domain/common"
import { useBackoffice } from "@/application/state/provider"
import {
  AccessPolicyEffectBadge,
  CommandErrorMessage,
} from "@/application/ui/backoffice-ui"

export type ApprovalDocumentRequestPageProps = {
  policy?: AccessPolicy
  approvalLine?: ApprovalLine
  policyId?: string
}

export function ApprovalDocumentRequestPage({
  policy,
  approvalLine,
  policyId,
}: ApprovalDocumentRequestPageProps) {
  const backoffice = useBackoffice()
  const common = useTranslations("backoffice.common")
  const documentsT = useTranslations("backoffice.approvalDocuments")
  const resolvedPolicy =
    policy ??
    (policyId
      ? backoffice.accessPolicies.find((item) => item.id === policyId)
      : undefined)
  const resolvedApprovalLine =
    approvalLine ??
    (resolvedPolicy
      ? resolveAccessPolicyApprovalLine(backoffice, resolvedPolicy.type)
      : undefined)

  if (
    !resolvedPolicy ||
    resolvedPolicy.managementType === accessPolicyManagementTypes.system ||
    !resolvedApprovalLine
  ) {
    return (
      <EmptyState
        title={documentsT("requestTitle")}
        description={documentsT("requestNotFound")}
        action={
          <Button
            nativeButton={false}
            render={<Link href="/approval-documents" />}
          >
            {common("backToList")}
          </Button>
        }
      />
    )
  }

  return (
    <ApprovalDocumentRequestForm
      policy={resolvedPolicy}
      approvalLine={resolvedApprovalLine}
    />
  )
}

function ApprovalDocumentRequestForm({
  policy,
  approvalLine,
}: {
  policy: AccessPolicy
  approvalLine: ApprovalLine
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const common = useTranslations("backoffice.common")
  const documentsT = useTranslations("backoffice.approvalDocuments")
  const [content, setContent] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [minimumExpirationTime] = useState(() => Date.now())
  const initialRequesterId = sessionAccess.currentUser?.id ?? null
  const initialOrganizationId =
    sessionAccess.currentUser?.organizationIds[0] ?? null
  const [requesterId, setRequesterId] = useState<string | null>(
    initialRequesterId,
  )
  const [requestOrganizationId, setRequestOrganizationId] = useState<
    string | null
  >(initialOrganizationId)
  const [approvalSteps, setApprovalSteps] = useState<
    RequestApprovalStepDraft[]
  >(() =>
    createRequestApprovalLineDraft(backoffice, approvalLine, {
      requesterId: initialRequesterId,
      requestOrganizationId: initialOrganizationId,
    }),
  )
  const [error, setError] = useState<BackofficeErrorCode>()
  const [requestStep, setRequestStep] = useState<ReviewWorkflowStep>(1)

  if (
    policy.status !== entityStatuses.active ||
    approvalLine.status !== entityStatuses.active ||
    approvalLine.category !== requestCategoryValues.permission ||
    policy.type !== approvalLine.type
  ) {
    throw new TypeError(`Access policy approval line not found: ${policy.id}`)
  }

  const policyResourceGroups = resolveAccessPolicyResourceGroups(
    backoffice,
    policy,
  )
  const policyUiResources = resolveAccessPolicyUiResources(backoffice, policy)
  const missingResourceCount = sessionAccess.currentUser
    ? resolveMissingAccessPolicyResources(
        backoffice,
        sessionAccess.currentUser.id,
        policy,
      ).length
    : policy.resources.length
  const requester = backoffice.users.find((item) => item.id === requesterId)
  const requestOrganization = backoffice.organizations.find(
    (item) => item.id === requestOrganizationId,
  )
  const approvalLineComplete = requestApprovalLineDraftIsComplete(
    approvalSteps,
    requesterId,
  )

  function resetApprovalSteps(
    nextRequesterId: string | null,
    nextOrganizationId: string | null,
  ) {
    setApprovalSteps(
      createRequestApprovalLineDraft(backoffice, approvalLine, {
        requesterId: nextRequesterId,
        requestOrganizationId: nextOrganizationId,
      }),
    )
  }

  function parseRequest(submission: ApprovalDocumentSubmission) {
    const parsed = approvalDocumentInputSchema.safeParse({
      documentKind: approvalDocumentKinds.general,
      title: documentsT("policyDocumentTitle", { policy: policy.name }),
      type: accessPolicyTypes.accessGrant,
      organizationId: requestOrganizationId,
      requesterId,
      approvalLineId: approvalLine.id,
      accessPolicyId: policy.id,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      content,
      fieldValues: [],
      approvalSteps: toRequestApprovalStepInputs(approvalSteps),
      submission,
    })
    if (!parsed.success) {
      setError("invalid-input")
      return null
    }
    return parsed.data
  }

  async function persistRequest(submission: ApprovalDocumentSubmission) {
    const input = parseRequest(submission)
    if (!input) return
    const result = await backoffice.createApprovalDocument(input)
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(
      documentsT(
        submission === approvalDocumentSubmissions.draft
          ? "draftCreated"
          : "submitted",
      ),
    )
    router.replace(`/approval-documents/requests/${result.value.id}`)
  }

  async function submit(form: HTMLFormElement) {
    if (requestStep === 1) {
      setError(undefined)
      if (approvalSteps.length === 0) {
        resetApprovalSteps(requesterId, requestOrganizationId)
      }
      setRequestStep(2)
      return
    }
    form.reset()
    await persistRequest("submitted")
  }

  async function saveDraft() {
    await persistRequest("draft")
  }

  const targetComplete = Boolean(requesterId && requestOrganizationId)
  const expirationComplete =
    expiresAt.length > 0 &&
    new Date(expiresAt).getTime() > minimumExpirationTime
  const reasonComplete = content.trim().length >= 10 && expirationComplete
  const inputComplete = targetComplete && reasonComplete
  const submitDisabled =
    !inputComplete || (requestStep === 2 && !approvalLineComplete)

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

  return (
    <RequestWorkflow
      title={documentsT("policyRequestTitle")}
      description={documentsT("policyRequestDescription")}
      cancelLabel={common("cancel")}
      cancelHref={`/approval-documents/${policy.id}`}
      {...(requestStep === 2
        ? {
            previousLabel: common("previous"),
            onPrevious: () => {
              setError(undefined)
              setRequestStep(1)
            },
          }
        : {})}
      submitLabel={requestStep === 1 ? common("next") : documentsT("submit")}
      submitDisabled={submitDisabled}
      {...(requestStep === 2
        ? {
            secondaryLabel: documentsT("saveDraft"),
            secondaryDisabled: submitDisabled,
            onSecondary: () => {
              void saveDraft()
            },
          }
        : {})}
      onSubmit={submit}
    >
      <ReviewWorkflowProgress
        step={requestStep}
        label={documentsT("requestStepLabel")}
      />

      {requestStep === 1 ? (
        <div className="grid gap-6">
          <section
            className="grid gap-4"
            aria-labelledby="request-target-title"
          >
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
                  const nextOrganizationId =
                    selected?.organizationIds[0] ?? null
                  setRequestOrganizationId(nextOrganizationId)
                  resetApprovalSteps(value, nextOrganizationId)
                }}
                options={backoffice.users
                  .filter(
                    (user) =>
                      user.employmentStatus === employmentStatusValues.employed,
                  )
                  .map((user) => ({ value: user.id, label: user.nickname }))}
              />
              <FormSelect
                label={documentsT("requestOrganization")}
                value={requestOrganizationId}
                onValueChange={(value) => {
                  setRequestOrganizationId(value)
                  resetApprovalSteps(requesterId, value)
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
          <section
            className="grid gap-4 border-t border-border-subtle pt-6"
            aria-labelledby="request-reason-title"
          >
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
            <Field>
              <FieldLabel htmlFor="approval-expires-at">
                {documentsT("grantExpiresAt")}
              </FieldLabel>
              <Input
                id="approval-expires-at"
                name="expiresAt"
                type="datetime-local"
                required
                value={expiresAt}
                onChange={(event) => {
                  setExpiresAt(event.target.value)
                }}
              />
              <p className="text-sm text-text-subtle">
                {documentsT("grantExpiresAtDescription")}
              </p>
            </Field>
          </section>
        </div>
      ) : null}

      {requestStep === 2 ? (
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
            <div className="grid content-start gap-1 border-t p-4 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">
                {documentsT("grantExpiresAt")}
              </dt>
              <dd className="font-medium">
                {expiresAt
                  ? new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(expiresAt))
                  : "—"}
              </dd>
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
          <div className="grid gap-2">
            <h4 className="text-sm font-semibold">
              {documentsT("approvalFlow")}
            </h4>
            <RequestApprovalLineEditor
              steps={approvalSteps}
              onChange={setApprovalSteps}
              users={backoffice.users}
              organizations={backoffice.organizations}
              requesterId={requesterId}
            />
          </div>
        </section>
      ) : null}
      <CommandErrorMessage error={error} />
    </RequestWorkflow>
  )
}
