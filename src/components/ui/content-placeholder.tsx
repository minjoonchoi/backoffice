import { ImageOffIcon } from "lucide-react"
import type * as React from "react"

import { cn } from "@/lib/utils"

type ContentPlaceholderAccessibility =
  | { "aria-label": string; "aria-hidden"?: never }
  | { "aria-label"?: never; "aria-hidden": true }

type ContentPlaceholderProps = Omit<
  React.ComponentProps<"div">,
  "aria-label" | "aria-hidden"
> &
  ContentPlaceholderAccessibility

function ContentPlaceholder({
  className,
  children,
  ...props
}: ContentPlaceholderProps) {
  return (
    <div
      data-slot="content-placeholder"
      role="img"
      className={cn(
        "flex min-h-32 w-full items-center justify-center rounded-card border border-dashed border-border bg-surface-subtle text-text-disabled",
        className,
      )}
      {...props}
    >
      {children ?? <ImageOffIcon aria-hidden="true" className="size-8" />}
    </div>
  )
}

export { ContentPlaceholder }
