import type * as React from "react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

function Field({
  className,
  invalid = false,
  disabled = false,
  ...props
}: React.ComponentProps<"div"> & {
  invalid?: boolean
  disabled?: boolean
}) {
  return (
    <div
      data-slot="field"
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      className={cn("group/field grid w-full gap-1.5", className)}
      {...props}
    />
  )
}

function FieldHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-header"
      className={cn(
        "flex min-w-0 items-start justify-between gap-3",
        className,
      )}
      {...props}
    />
  )
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn("min-w-0", className)}
      {...props}
    />
  )
}

function FieldMeta({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="field-meta"
      className={cn(
        "shrink-0 text-caption text-text-subtle tabular-nums",
        className,
      )}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-body text-text-subtle", className)}
      {...props}
    />
  )
}

function FieldError({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-error"
      role="alert"
      className={cn("text-body text-destructive-foreground", className)}
      {...props}
    />
  )
}

export {
  Field,
  FieldDescription,
  FieldError,
  FieldHeader,
  FieldLabel,
  FieldMeta,
}
