"use client"

import { Check } from "lucide-react"
import { useTranslations } from "next-intl"

export type ReviewWorkflowStep = 1 | 2

export function ReviewWorkflowProgress({
  step,
  label,
}: {
  step: ReviewWorkflowStep
  label: string
}) {
  const common = useTranslations("backoffice.common")
  const steps = [common("inputStep"), common("reviewStep")] as const

  return (
    <ol
      className="grid grid-cols-2 gap-1 rounded-card bg-surface-subtle p-1"
      aria-label={label}
    >
      {steps.map((stepLabel, index) => {
        const number = (index + 1) as ReviewWorkflowStep
        const complete = number < step
        return (
          <li
            key={stepLabel}
            aria-current={number === step ? "step" : undefined}
            className="flex min-w-0 items-center justify-center gap-1.5 rounded-control px-2 py-1 text-center"
          >
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-full border text-[0.6875rem] font-semibold ${
                number <= step
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-text-subtle"
              }`}
            >
              {complete ? <Check className="size-3" aria-hidden /> : number}
            </span>
            <span className="truncate text-xs font-medium">{stepLabel}</span>
          </li>
        )
      })}
    </ol>
  )
}
