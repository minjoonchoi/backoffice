"use client"

import { useState, type ComponentProps, type ReactNode } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

export type ConfirmActionProps = {
  trigger: ReactNode
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel: string
  disabled?: boolean
  confirmDisabled?: boolean
  triggerAriaLabel?: string
  triggerTitle?: string
  triggerVariant?: ComponentProps<typeof Button>["variant"]
  triggerSize?: ComponentProps<typeof Button>["size"]
  onConfirm: () => void | Promise<void>
}

export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  disabled,
  confirmDisabled,
  triggerAriaLabel,
  triggerTitle,
  triggerVariant = "destructive",
  triggerSize = "default",
  onConfirm,
}: ConfirmActionProps) {
  const [isConfirming, setIsConfirming] = useState(false)

  async function confirm() {
    setIsConfirming(true)
    try {
      await onConfirm()
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        disabled={disabled}
        aria-label={triggerAriaLabel}
        title={triggerTitle}
        render={<Button variant={triggerVariant} size={triggerSize} />}
      >
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isConfirming || confirmDisabled}
            aria-busy={isConfirming}
            onClick={() => void confirm()}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
