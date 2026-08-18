import type * as React from "react"

import { cn } from "@/lib/utils"

type TagGroupProps = React.ComponentProps<"ul"> & {
  size?: "sm" | "default"
}

function TagGroup({ className, size = "default", ...props }: TagGroupProps) {
  return (
    <ul
      data-slot="tag-group"
      data-size={size}
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-1.5 text-text-subtle [&_svg]:shrink-0",
        size === "sm"
          ? "text-caption [&_svg]:size-3"
          : "text-body [&_svg]:size-3.5",
        className,
      )}
      {...props}
    />
  )
}

type TagItemProps = React.ComponentProps<"li"> & {
  tone?: "default" | "subtle" | "brand"
  weight?: "regular" | "strong"
}

function TagItem({
  className,
  tone = "default",
  weight = "regular",
  ...props
}: TagItemProps) {
  return (
    <li
      data-slot="tag-item"
      className={cn(
        "inline-flex min-w-0 items-center gap-1",
        tone === "default" && "text-foreground",
        tone === "subtle" && "text-text-subtle",
        tone === "brand" && "text-brand-weak-foreground",
        weight === "strong" && "font-semibold",
        className,
      )}
      {...props}
    />
  )
}

function TagSeparator({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="tag-separator"
      aria-hidden="true"
      className={cn("text-text-disabled select-none", className)}
      {...props}
    >
      ·
    </li>
  )
}

export { TagGroup, TagItem, TagSeparator }
