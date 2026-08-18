"use client"

import { approvalDecisions } from "@/features/access-policies/model"
import { approvalDocumentHistoryEventTypes } from "@/features/access-policies/model"
import { approvalStepStatuses } from "@/features/access-policies/model"
import { approvalDocumentStatuses } from "@/features/access-policies/model"
import { approvalStepKindValues } from "@/features/request-templates/model"
import { approvalTypeValues } from "@/features/request-templates/model"
import { approvalExecutionTypeValues } from "@/features/request-templates/model"
import { approvalDocumentKinds } from "@/features/access-policies/model"
import { approvalAssigneeTypes } from "@/features/access-policies/model"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { UiResourceLink } from "@/auth/ui-resource-link"
import { ConfirmAction } from "@/components/patterns/confirm-action"
import { EmptyState } from "@/components/patterns/content-state"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import {
  FormDialog,
  FormDialogContent,
} from "@/components/patterns/form-dialog"
import { PageHeader } from "@/components/patterns/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import { uiResourceKeys } from "@/config/menu-registry"
import { useBackoffice } from "@/application/state/provider"
import type {
  ApprovalDocumentActionInput,
  ApprovalDocumentHistoryEvent,
  ApprovalDocumentStep,
} from "@/features/access-policies/model"
import {
  ApprovalStatusBadge,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

export function ApprovalDocumentDetailPage({
  requestId,
}: {
  requestId: string
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.approvalDocuments")
  const errorsT = useTranslations("backoffice.errors")
  const labels = useBackofficeLabels()
  const [processing, setProcessing] = useState<{
    step: ApprovalDocumentStep
    decision: ApprovalDocumentActionInput["decision"]
  }>()
  const [comment, setComment] = useState("")
  const document = backoffice.approvalDocuments.find(
    (candidate) => candidate.id === requestId,
  )
  if (!document) {
    return (
      <EmptyState
        title={t("requestDetailTitle")}
        description={t("requestNotFound")}
        action={
          <Button render={<Link href="/approval-documents" />}>
            {common("backToList")}
          </Button>
        }
      />
    )
  }

  const requester = backoffice.users.find(
    (candidate) => candidate.id === document.requesterId,
  )
  const organization = backoffice.organizations.find(
    (candidate) => candidate.id === document.organizationId,
  )
  const template = backoffice.approvalLines.find(
    (candidate) => candidate.id === document.approvalLineId,
  )
  if (!requester || !organization || !template) {
    throw new Error(`Request reference not found: ${document.id}`)
  }
  const documentId = document.id
  const permissionTarget =
    document.documentKind === approvalDocumentKinds.general &&
    document.type === approvalTypeValues.accessGrant
      ? backoffice.users.find((user) => user.id === document.targetUserId)
      : null
  if (
    document.documentKind === approvalDocumentKinds.general &&
    document.type === approvalTypeValues.accessGrant &&
    !permissionTarget
  ) {
    throw new Error(`Permission target not found: ${document.id}`)
  }

  const relatedTarget =
    document.documentKind === approvalDocumentKinds.general &&
    document.type === approvalTypeValues.accessGrant
      ? backoffice.accessPolicies.find(
          (policy) => policy.id === document.accessPolicyId,
        )
      : document.documentKind === approvalDocumentKinds.apiKeyIssuance
        ? backoffice.services.find(
            (service) => service.id === document.serviceId,
          )
        : document.documentKind === approvalDocumentKinds.apiKeyLifecycle
          ? backoffice.apiKeys.find((apiKey) => apiKey.id === document.apiKeyId)
          : null
  const currentUser = sessionAccess.currentUser
  const canProcess = sessionAccess.canAccessUiResource(
    uiResourceKeys.approvalDocuments.requestDetail.actions.processRequest,
  )
  const canWithdraw = sessionAccess.canAccessUiResource(
    uiResourceKeys.approvalDocuments.requestDetail.actions.withdrawRequest,
  )
  const canResubmit = sessionAccess.canAccessUiResource(
    uiResourceKeys.approvalDocuments.requestDetail.actions.resubmitRequest,
  )
  const requesterOwnsDocument = currentUser?.id === document.requesterId
  const usesGroo =
    document.approvalExecution.type === approvalExecutionTypeValues.groo

  function isCurrentAssignee(step: ApprovalDocumentStep) {
    if (!currentUser) return false
    return step.assigneeType === approvalAssigneeTypes.user
      ? step.assigneeId === currentUser.id
      : currentUser.organizationIds.includes(step.assigneeId)
  }

  function historyEventLabel(type: ApprovalDocumentHistoryEvent["type"]) {
    switch (type) {
      case approvalDocumentHistoryEventTypes.draftSaved:
        return t("historyEvents.draft-saved")
      case approvalDocumentStatuses.submitted:
        return t("historyEvents.submitted")
      case approvalDocumentStatuses.approved:
        return t("historyEvents.approved")
      case approvalDocumentHistoryEventTypes.agreed:
        return t("historyEvents.agreed")
      case approvalDocumentHistoryEventTypes.referenced:
        return t("historyEvents.referenced")
      case approvalDocumentStatuses.rejected:
        return t("historyEvents.rejected")
      case approvalDocumentStatuses.withdrawn:
        return t("historyEvents.withdrawn")
      case approvalDocumentHistoryEventTypes.resubmitted:
        return t("historyEvents.resubmitted")
    }
  }

  async function processStep() {
    if (!processing || !currentUser) return
    const result = await backoffice.processApprovalDocument({
      documentId,
      actorUserId: currentUser.id,
      stepId: processing.step.id,
      decision: processing.decision,
      comment,
    })
    if (!result.ok) {
      snackbar.error(errorsT(result.error))
      return
    }
    snackbar.success(t("requestProcessed"))
    setProcessing(undefined)
    setComment("")
  }

  async function withdraw() {
    if (!currentUser) return
    const result = await backoffice.withdrawApprovalDocument({
      documentId,
      actorUserId: currentUser.id,
    })
    if (!result.ok) {
      snackbar.error(errorsT(result.error))
      return
    }
    snackbar.success(t("requestWithdrawn"))
  }

  async function resubmit() {
    if (!currentUser) return
    const result = await backoffice.resubmitApprovalDocument({
      documentId,
      actorUserId: currentUser.id,
    })
    if (!result.ok) {
      snackbar.error(errorsT(result.error))
      return
    }
    snackbar.success(t("requestResubmitted"))
  }

  const headerActions =
    requesterOwnsDocument && !usesGroo ? (
      <>
        {document.status === approvalDocumentStatuses.submitted &&
        canWithdraw ? (
          <ConfirmAction
            trigger={t("withdrawRequest")}
            title={t("withdrawRequestTitle")}
            description={t("withdrawRequestDescription")}
            confirmLabel={t("withdrawRequest")}
            cancelLabel={common("cancel")}
            onConfirm={withdraw}
          />
        ) : null}
        {(document.status === approvalDocumentStatuses.draft ||
          document.status === approvalDocumentStatuses.rejected ||
          document.status === approvalDocumentStatuses.withdrawn) &&
        canResubmit ? (
          <Button onClick={() => void resubmit()}>
            {t("resubmitRequest")}
          </Button>
        ) : null}
      </>
    ) : undefined

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("requestDetailEyebrow")}
        title={document.title}
        description={t("requestDetailDescription")}
        actions={headerActions}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("requestSummary")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailItem label={t("requestType")}>
              {labels.approvalType(document.type)}
            </DetailItem>
            <DetailItem label={common("status")}>
              <ApprovalStatusBadge status={document.status} />
            </DetailItem>
            <DetailItem label={t("requester")}>
              <UiResourceLink
                resourceKey={uiResourceKeys.users.detail.key}
                href={`/users/${requester.id}`}
              >
                {requester.nickname}
              </UiResourceLink>
            </DetailItem>
            <DetailItem label={t("requestOrganization")}>
              <UiResourceLink
                resourceKey={uiResourceKeys.organizations.detail.key}
                href={`/organizations/${organization.id}`}
              >
                {organization.name}
              </UiResourceLink>
            </DetailItem>
            {permissionTarget ? (
              <DetailItem label={t("permissionTarget")}>
                <UiResourceLink
                  resourceKey={uiResourceKeys.users.detail.key}
                  href={`/users/${permissionTarget.id}`}
                >
                  {permissionTarget.nickname}
                </UiResourceLink>
              </DetailItem>
            ) : null}
            {document.documentKind === approvalDocumentKinds.general &&
            document.type === approvalTypeValues.accessGrant ? (
              <DetailItem label={t("accessRequestMode")}>
                {t(`accessRequestModes.${document.requestMode}`)}
              </DetailItem>
            ) : null}
            <DetailItem label={t("approvalLine")}>{template.name}</DetailItem>
            <DetailItem label={t("approvalExecution")}>
              {t(`approvalExecutions.${document.approvalExecution.type}`)}
            </DetailItem>
            {document.approvalExecution.type ===
            approvalExecutionTypeValues.groo ? (
              <DetailItem label={t("grooRequestId")}>
                <code className="text-xs break-all">
                  {document.approvalExecution.requestId}
                </code>
              </DetailItem>
            ) : null}
            <DetailItem label={common("createdAt")}>
              {labels.dateTime(document.createdAt)}
            </DetailItem>
            {relatedTarget ? (
              <DetailItem label={t("requestTarget")}>
                {relatedTarget.name}
              </DetailItem>
            ) : null}
            {document.documentKind === approvalDocumentKinds.general &&
            document.type === approvalTypeValues.accessGrant ? (
              <DetailItem label={t("grantExpiresAt")}>
                {labels.dateTime(document.expiresAt)}
              </DetailItem>
            ) : null}
            <DetailItem label={t("requestContent")} className="sm:col-span-2">
              <span className="whitespace-pre-wrap">{document.content}</span>
            </DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>
      {document.fieldValues.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("requestInputValues")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid>
              {document.fieldValues.map((fieldValue) => {
                const field = template.fields.find(
                  (candidate) => candidate.id === fieldValue.fieldId,
                )
                if (!field) {
                  throw new Error(
                    `Request field not found: ${fieldValue.fieldId}`,
                  )
                }
                return (
                  <DetailItem key={fieldValue.fieldId} label={field.label}>
                    <span className="break-words whitespace-pre-wrap">
                      {fieldValue.value}
                    </span>
                  </DetailItem>
                )
              })}
            </DetailGrid>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>
            {usesGroo ? t("grooApprovalFlow") : t("approvalFlow")}
          </CardTitle>
          <CardDescription>
            {usesGroo
              ? t("grooApprovalFlowDescription")
              : t("approvalFlowDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usesGroo ? (
            <div className="flex flex-wrap items-center gap-2 rounded-card border border-border-subtle bg-surface-subtle p-3">
              <ApprovalStatusBadge status={document.status} />
              <span className="text-sm text-muted-foreground">
                {document.status === approvalDocumentStatuses.submitted
                  ? t("grooCompletionHookNotice")
                  : t("grooCompletionAppliedNotice")}
              </span>
            </div>
          ) : (
            <ol className="grid gap-2">
              {document.approvalSteps.map((step) => {
                const assignee =
                  step.assigneeType === approvalAssigneeTypes.user
                    ? backoffice.users.find(
                        (user) => user.id === step.assigneeId,
                      )?.nickname
                    : backoffice.organizations.find(
                        (item) => item.id === step.assigneeId,
                      )?.name
                if (!assignee)
                  throw new Error(`Request assignee not found: ${step.id}`)
                return (
                  <li
                    key={step.id}
                    className="grid gap-1 rounded-card border border-border-subtle p-3 sm:grid-cols-[5rem_1fr_auto] sm:items-center"
                  >
                    <span className="text-xs font-medium text-text-subtle">
                      {t("approvalStage", { stage: step.stage })}
                    </span>
                    <span className="font-medium">{assignee}</span>
                    <span className="flex flex-wrap items-center justify-end gap-2">
                      <span className="text-sm text-muted-foreground">
                        {labels.stepKind(step.kind)}
                      </span>
                      <Badge
                        variant={
                          step.status === approvalStepStatuses.completed
                            ? "success"
                            : step.status === approvalStepStatuses.pending
                              ? "warning"
                              : step.status === approvalStepStatuses.rejected
                                ? "destructive"
                                : "secondary"
                        }
                      >
                        {t(`stepStatuses.${step.status}`)}
                      </Badge>
                      {step.status === approvalStepStatuses.pending &&
                      canProcess &&
                      isCurrentAssignee(step) ? (
                        <span className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setProcessing({
                                step,
                                decision:
                                  step.kind === approvalStepKindValues.reference
                                    ? "acknowledge"
                                    : "approve",
                              })
                            }}
                          >
                            {step.kind === approvalStepKindValues.agreement
                              ? t("agree")
                              : step.kind === approvalStepKindValues.reference
                                ? t("acknowledge")
                                : t("approve")}
                          </Button>
                          {step.kind !== approvalStepKindValues.reference ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setProcessing({
                                  step,
                                  decision: approvalDecisions.reject,
                                })
                              }}
                            >
                              {t("reject")}
                            </Button>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("processingHistory")}</CardTitle>
          <CardDescription>{t("processingHistoryDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3">
            {document.history.toReversed().map((event) => {
              const actor = event.actorUserId
                ? backoffice.users.find((user) => user.id === event.actorUserId)
                : null
              if (event.actorUserId && !actor)
                throw new Error(`Request history actor not found: ${event.id}`)
              return (
                <li
                  key={event.id}
                  className="grid gap-1 border-l-2 border-border-subtle py-1 pl-4 sm:grid-cols-[1fr_auto]"
                >
                  <span>
                    <span className="font-medium">
                      {historyEventLabel(event.type)}
                    </span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {actor?.nickname ?? t("groo")}
                    </span>
                    {event.comment ? (
                      <span className="mt-1 block text-sm whitespace-pre-wrap text-text-subtle">
                        {event.comment}
                      </span>
                    ) : null}
                  </span>
                  <time className="text-xs text-muted-foreground">
                    {labels.dateTime(event.createdAt)}
                  </time>
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>
      <FormDialog
        open={Boolean(processing)}
        onOpenChange={(open) => {
          if (!open) {
            setProcessing(undefined)
            setComment("")
          }
        }}
      >
        <FormDialogContent>
          <DialogHeader>
            <DialogTitle>
              {processing?.decision === approvalDecisions.reject
                ? t("rejectRequestTitle")
                : t("processRequestTitle")}
            </DialogTitle>
            <DialogDescription>
              {processing?.decision === approvalDecisions.reject
                ? t("rejectRequestDescription")
                : t("processRequestDescription")}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="approval-comment">
              {t("processingComment")}
            </FieldLabel>
            <Textarea
              id="approval-comment"
              value={comment}
              required={processing?.decision === approvalDecisions.reject}
              maxLength={1000}
              onChange={(event) => {
                setComment(event.target.value)
              }}
            />
          </Field>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {common("cancel")}
            </DialogClose>
            <Button
              disabled={
                processing?.decision === approvalDecisions.reject &&
                !comment.trim().length
              }
              onClick={() => void processStep()}
            >
              {processing?.decision === approvalDecisions.reject
                ? t("reject")
                : t("completeProcessing")}
            </Button>
          </DialogFooter>
        </FormDialogContent>
      </FormDialog>
    </div>
  )
}
