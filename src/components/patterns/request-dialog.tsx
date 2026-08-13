"use client"

import type { LucideIcon } from "lucide-react"
import { useId, type ReactNode } from "react"

import {
  FormDialog,
  FormDialogContent,
} from "@/components/patterns/form-dialog"
import { Button } from "@/components/ui/button"
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type RequestDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerLabel: string
  triggerIcon?: LucideIcon
  title: string
  description: string
  children: ReactNode
  cancelLabel: string
  previousLabel?: string
  submitLabel: string
  submitDisabled?: boolean
  onPrevious?: () => void
  onSubmit: (form: HTMLFormElement) => void
}

export function RequestDialog({
  open,
  onOpenChange,
  triggerLabel,
  triggerIcon: TriggerIcon,
  title,
  description,
  children,
  cancelLabel,
  previousLabel,
  submitLabel,
  submitDisabled = false,
  onPrevious,
  onSubmit,
}: RequestDialogProps) {
  const formId = useId()

  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        {TriggerIcon ? <TriggerIcon /> : null}
        {triggerLabel}
      </DialogTrigger>
      <FormDialogContent className="max-h-[min(90svh,56rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          id={formId}
          className="grid min-h-0 gap-6 overflow-y-auto pr-1"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(event.currentTarget)
          }}
        >
          {children}
        </form>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {cancelLabel}
          </DialogClose>
          {previousLabel && onPrevious ? (
            <Button type="button" variant="outline" onClick={onPrevious}>
              {previousLabel}
            </Button>
          ) : null}
          <Button type="submit" form={formId} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}
