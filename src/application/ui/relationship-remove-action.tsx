"use client"

import { Unlink } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmAction } from "@/components/patterns/confirm-action"
import { snackbar } from "@/components/ui/snackbar"
import type { CommandResult } from "@/domain/common"

export function RelationshipRemoveAction({
  subjectName,
  targetName,
  disabled = false,
  confirmDisabled = false,
  impactDescription,
  onRemove,
}: {
  subjectName: string
  targetName: string
  disabled?: boolean
  confirmDisabled?: boolean
  impactDescription?: string
  onRemove: () => Promise<CommandResult<unknown>>
}) {
  const common = useTranslations("backoffice.common")
  const errors = useTranslations("backoffice.errors")

  async function remove() {
    const result = await onRemove()
    if (!result.ok) {
      snackbar.error(errors(result.error))
      return
    }
    snackbar.success(common("relationshipRemoved", { name: targetName }))
  }

  return (
    <ConfirmAction
      trigger={
        <>
          <Unlink />
          {common("remove")}
        </>
      }
      triggerAriaLabel={common("removeRelationshipLabel", {
        name: targetName,
      })}
      {...(disabled ? { triggerTitle: common("protectedRelationship") } : {})}
      triggerVariant="outline"
      triggerSize="sm"
      title={common("removeRelationshipTitle", { name: targetName })}
      description={
        <span className="grid gap-2">
          <span>
            {common("removeRelationshipDescription", {
              subject: subjectName,
              target: targetName,
            })}
          </span>
          {impactDescription ? (
            <span className="rounded-control bg-warning px-3 py-2 text-warning-foreground">
              {impactDescription}
            </span>
          ) : null}
        </span>
      }
      confirmLabel={common("remove")}
      cancelLabel={common("cancel")}
      disabled={disabled}
      confirmDisabled={confirmDisabled}
      onConfirm={remove}
    />
  )
}
