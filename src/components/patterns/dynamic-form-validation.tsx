"use client"

import { useCallback, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import type { ZodError, z } from "zod"

import { FieldError } from "@/components/ui/field"

export type DynamicFieldValidation = Readonly<{
  error: string | undefined
  errorId: string | undefined
  invalid: boolean
}>

function fieldPath(issue: z.core.$ZodIssue) {
  return issue.path.map(String).join(".")
}

export function useDynamicFormValidation(error: ZodError | undefined) {
  const t = useTranslations("backoffice.validation")
  const [touchedFields, setTouchedFields] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [showAllErrors, setShowAllErrors] = useState(false)

  const issuesByPath = useMemo(() => {
    const issues = new Map<string, z.core.$ZodIssue>()
    for (const issue of error?.issues ?? []) {
      const path = fieldPath(issue)
      if (path && !issues.has(path)) issues.set(path, issue)
    }
    return issues
  }, [error])

  const messageFor = useCallback(
    (issue: z.core.$ZodIssue) => {
      switch (issue.code) {
        case "too_small":
          if (issue.origin === "string") {
            return t("minLength", { minimum: String(issue.minimum) })
          }
          if (issue.origin === "array" || issue.origin === "set") {
            return t("minSelection", { minimum: String(issue.minimum) })
          }
          return t("minimum", { minimum: String(issue.minimum) })
        case "too_big":
          if (issue.origin === "string") {
            return t("maxLength", { maximum: String(issue.maximum) })
          }
          if (issue.origin === "array" || issue.origin === "set") {
            return t("maxSelection", { maximum: String(issue.maximum) })
          }
          return t("maximum", { maximum: String(issue.maximum) })
        case "invalid_format":
          return issue.format === "email" ? t("email") : t("format")
        case "invalid_type":
        case "invalid_value":
          return t("required")
        default:
          return t("invalid")
      }
    },
    [t],
  )

  const touch = useCallback((name: string) => {
    setTouchedFields((current) => {
      if (current.has(name)) return current
      return new Set([...current, name])
    })
  }, [])

  const revealAll = useCallback(() => {
    setShowAllErrors(true)
  }, [])
  const reset = useCallback(() => {
    setTouchedFields(new Set())
    setShowAllErrors(false)
  }, [])

  const getFieldValidation = useCallback(
    (name: string, errorId: string): DynamicFieldValidation => {
      const entry = [...issuesByPath.entries()].find(
        ([path]) => path === name || path.startsWith(`${name}.`),
      )
      const touched = [...touchedFields].some(
        (path) => path === name || path.startsWith(`${name}.`),
      )
      const issue = showAllErrors || touched ? entry?.[1] : undefined
      return {
        error: issue ? messageFor(issue) : undefined,
        errorId: issue ? errorId : undefined,
        invalid: issue !== undefined,
      }
    },
    [issuesByPath, messageFor, showAllErrors, touchedFields],
  )

  const shouldShowError = useCallback(
    (name: string) =>
      showAllErrors ||
      [...touchedFields].some(
        (path) => path === name || path.startsWith(`${name}.`),
      ),
    [showAllErrors, touchedFields],
  )

  return { getFieldValidation, reset, revealAll, shouldShowError, touch }
}

export function FieldValidationMessage({
  validation,
}: {
  validation: DynamicFieldValidation
}) {
  return validation.error ? (
    <FieldError id={validation.errorId}>{validation.error}</FieldError>
  ) : null
}
