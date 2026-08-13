import type * as React from "react"

import { cn } from "@/lib/utils"

type ResultSectionProps = React.ComponentProps<"section"> & {
  size?: "medium" | "large"
}

function ResultSection({
  className,
  size = "medium",
  ...props
}: ResultSectionProps) {
  return (
    <section
      data-slot="result-section"
      data-size={size}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "medium" ? "min-h-48 gap-3 p-6" : "min-h-64 gap-4 p-8",
        className,
      )}
      {...props}
    />
  )
}

function ResultSectionMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="result-section-media"
      className={cn(
        "flex size-11 items-center justify-center rounded-lg bg-brand-weak text-brand-weak-foreground [&_svg]:size-5",
        className,
      )}
      {...props}
    />
  )
}

function ResultSectionHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="result-section-header"
      className={cn("grid max-w-lg gap-1", className)}
      {...props}
    />
  )
}

function ResultSectionTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="result-section-title"
      className={cn("text-heading font-semibold text-text-strong", className)}
      {...props}
    />
  )
}

function ResultSectionDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="result-section-description"
      className={cn("text-body text-text-subtle", className)}
      {...props}
    />
  )
}

function ResultSectionActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="result-section-actions"
      className={cn("flex flex-wrap justify-center gap-2", className)}
      {...props}
    />
  )
}

export {
  ResultSection,
  ResultSectionActions,
  ResultSectionDescription,
  ResultSectionHeader,
  ResultSectionMedia,
  ResultSectionTitle,
}
