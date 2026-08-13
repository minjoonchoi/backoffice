import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "@/lib/utils"

const notificationBadgeVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full border-2 border-surface bg-destructive-solid text-destructive-solid-foreground",
  {
    variants: {
      variant: {
        dot: "size-2.5",
        count: "h-5 min-w-5 px-1 text-[0.6875rem] leading-none font-semibold",
      },
    },
    defaultVariants: {
      variant: "dot",
    },
  },
)

type NotificationBadgeProps = Omit<React.ComponentProps<"span">, "children"> &
  VariantProps<typeof notificationBadgeVariants> & {
    value?: number
    max?: number
  }

function NotificationBadge({
  className,
  variant = "dot",
  value = 0,
  max = 99,
  ...props
}: NotificationBadgeProps) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(
      "NotificationBadge value must be a non-negative integer",
    )
  }
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError("NotificationBadge max must be a positive integer")
  }

  return (
    <span
      role="status"
      data-slot="notification-badge"
      className={cn(notificationBadgeVariants({ variant }), className)}
      {...props}
    >
      {variant === "count" ? (value > max ? `${String(max)}+` : value) : null}
    </span>
  )
}

export { NotificationBadge, notificationBadgeVariants }
