"use client"

import { approvalStepKindValues } from "@/features/request-templates/model"
import { approvalAssigneeTypes } from "@/features/access-policies/model"
import { employmentStatusValues } from "@/features/iam/model"
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { useBackofficeLabels } from "@/application/ui/backoffice-ui"
import { FormSelect } from "@/components/patterns/form-select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { Organization, BackofficeUser } from "@/features/iam/model"
import type { ApprovalStepKind } from "@/features/request-templates/model"
import type { RequestApprovalStepDraft } from "@/features/request-templates/request-approval-line"

const editableStepKinds: Exclude<
  ApprovalStepKind,
  typeof approvalStepKindValues.request
>[] = [
  approvalStepKindValues.approval,
  approvalStepKindValues.agreement,
  approvalStepKindValues.reference,
]

function stabilizeParallelStages(steps: RequestApprovalStepDraft[]) {
  return steps.map((step, index) =>
    index <= 1 ? { ...step, parallelWithPrevious: false } : step,
  )
}

export function RequestApprovalLineEditor({
  steps,
  onChange,
  users,
  organizations,
  requesterId,
}: {
  steps: RequestApprovalStepDraft[]
  onChange: (steps: RequestApprovalStepDraft[]) => void
  users: readonly BackofficeUser[]
  organizations: readonly Organization[]
  requesterId: string | null | undefined
}) {
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.approvalDocuments")
  const labels = useBackofficeLabels()

  function updateStep(
    index: number,
    update: (step: RequestApprovalStepDraft) => RequestApprovalStepDraft,
  ) {
    onChange(
      steps.map((step, itemIndex) =>
        itemIndex === index ? update(step) : step,
      ),
    )
  }

  function moveStep(index: number, offset: -1 | 1) {
    const targetIndex = index + offset
    if (index <= 0 || targetIndex <= 0 || targetIndex >= steps.length) return
    const next = [...steps]
    const current = next[index]
    const target = next[targetIndex]
    if (!current || !target) return
    next[index] = target
    next[targetIndex] = current
    onChange(stabilizeParallelStages(next))
  }

  function removeStep(index: number) {
    onChange(
      stabilizeParallelStages(
        steps.filter((_, itemIndex) => itemIndex !== index),
      ),
    )
  }

  function addStep() {
    if (steps.length >= 12) return
    onChange([
      ...steps,
      {
        id: crypto.randomUUID(),
        kind: approvalStepKindValues.approval,
        assigneeType: approvalAssigneeTypes.user,
        assigneeId: null,
        parallelWithPrevious: false,
      },
    ])
  }

  return (
    <section
      className="grid gap-3"
      aria-labelledby="request-approval-line-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h4 id="request-approval-line-title" className="font-semibold">
            {t("editableApprovalLine")}
          </h4>
          <p className="text-sm text-muted-foreground">
            {t("editableApprovalLineDescription")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addStep}
          disabled={steps.length >= 12}
        >
          <Plus />
          {t("addApprovalStep")}
        </Button>
      </div>

      <ol className="grid max-h-[min(42svh,28rem)] gap-2 overflow-y-auto pr-1">
        {steps.map((step, index) => {
          const requesterStep =
            index === 0 && step.kind === approvalStepKindValues.request
          const assigneeOptions =
            step.assigneeType === approvalAssigneeTypes.user
              ? users
                  .filter(
                    (user) =>
                      user.employmentStatus ===
                        employmentStatusValues.employed &&
                      (step.kind === approvalStepKindValues.reference ||
                        user.id !== requesterId),
                  )
                  .map((user) => ({ value: user.id, label: user.nickname }))
              : organizations.map((organization) => ({
                  value: organization.id,
                  label: organization.name,
                }))
          const assigneeName =
            step.assigneeType === approvalAssigneeTypes.user
              ? users.find((user) => user.id === step.assigneeId)?.nickname
              : organizations.find(
                  (organization) => organization.id === step.assigneeId,
                )?.name

          return (
            <li
              key={step.id}
              className="grid gap-3 rounded-card border bg-surface p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-subtle text-xs font-semibold">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {labels.stepKind(step.kind)}
                  {index > 1 && step.parallelWithPrevious
                    ? ` · ${t("parallelWithPrevious")}`
                    : null}
                </span>
                {!requesterStep ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("moveApprovalStepUp", { order: index + 1 })}
                      onClick={() => {
                        moveStep(index, -1)
                      }}
                      disabled={index === 1}
                    >
                      <ChevronUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("moveApprovalStepDown", {
                        order: index + 1,
                      })}
                      onClick={() => {
                        moveStep(index, 1)
                      }}
                      disabled={index === steps.length - 1}
                    >
                      <ChevronDown />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("removeApprovalStep", { order: index + 1 })}
                      onClick={() => {
                        removeStep(index)
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </span>
                ) : null}
              </div>

              {requesterStep ? (
                <p className="text-sm text-muted-foreground">
                  {assigneeName ?? t("assigneeRequired")} ·{" "}
                  {t("requesterStepFixed")}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)]">
                  <FormSelect
                    label={t("processingKind")}
                    value={
                      step.kind === approvalStepKindValues.request
                        ? null
                        : step.kind
                    }
                    onValueChange={(value) => {
                      if (!value) return
                      updateStep(index, (current) => ({
                        ...current,
                        kind: value,
                        assigneeId:
                          value !== approvalStepKindValues.reference &&
                          current.assigneeType === approvalAssigneeTypes.user &&
                          current.assigneeId === requesterId
                            ? null
                            : current.assigneeId,
                      }))
                    }}
                    options={editableStepKinds.map((kind) => ({
                      value: kind,
                      label: labels.stepKind(kind),
                    }))}
                  />
                  <FormSelect
                    label={t("assigneeType")}
                    value={step.assigneeType}
                    onValueChange={(value) => {
                      if (!value) return
                      updateStep(index, (current) => ({
                        ...current,
                        assigneeType: value,
                        assigneeId: null,
                      }))
                    }}
                    options={[
                      { value: "user", label: common("user") },
                      { value: "organization", label: common("organization") },
                    ]}
                  />
                  <FormSelect
                    label={t("stepAssignee")}
                    value={step.assigneeId}
                    onValueChange={(value) => {
                      updateStep(index, (current) => ({
                        ...current,
                        assigneeId: value,
                      }))
                    }}
                    options={assigneeOptions}
                  />
                </div>
              )}

              {!requesterStep && index > 1 ? (
                <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={step.parallelWithPrevious}
                    onCheckedChange={(checked) => {
                      updateStep(index, (current) => ({
                        ...current,
                        parallelWithPrevious: checked,
                      }))
                    }}
                  />
                  {t("processInParallelWithPrevious")}
                </label>
              ) : null}
            </li>
          )
        })}
      </ol>

      {!steps.some(
        (step) =>
          step.kind === approvalStepKindValues.approval ||
          step.kind === approvalStepKindValues.agreement,
      ) ? (
        <p className="text-sm text-destructive-foreground" role="alert">
          {t("decisionStepRequired")}
        </p>
      ) : steps.some((step) => !step.assigneeId) ? (
        <p className="text-sm text-destructive-foreground" role="alert">
          {t("assigneeRequired")}
        </p>
      ) : null}
    </section>
  )
}
