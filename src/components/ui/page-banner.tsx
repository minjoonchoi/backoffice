import { cva, type VariantProps } from "class-variance-authority"
import { XIcon } from "lucide-react"
import type * as React from "react"

import { cn } from "@/lib/utils"

const pageBannerVariants = cva("flex gap-3 rounded-card border p-3 text-body", {
  variants: {
    tone: {
      neutral: "",
      info: "",
      success: "",
      warning: "",
      destructive: "",
    },
    variant: {
      weak: "",
      solid: "",
    },
  },
  compoundVariants: [
    {
      tone: "neutral",
      variant: "weak",
      className: "border-border bg-secondary text-secondary-foreground",
    },
    {
      tone: "neutral",
      variant: "solid",
      className:
        "border-neutral-solid bg-neutral-solid text-neutral-solid-foreground",
    },
    {
      tone: "info",
      variant: "weak",
      className: "border-info-foreground/25 bg-info text-info-foreground",
    },
    {
      tone: "info",
      variant: "solid",
      className: "border-info-solid bg-info-solid text-info-solid-foreground",
    },
    {
      tone: "success",
      variant: "weak",
      className:
        "border-success-foreground/25 bg-success text-success-foreground",
    },
    {
      tone: "success",
      variant: "solid",
      className:
        "border-success-solid bg-success-solid text-success-solid-foreground",
    },
    {
      tone: "warning",
      variant: "weak",
      className:
        "border-warning-foreground/25 bg-warning text-warning-foreground",
    },
    {
      tone: "warning",
      variant: "solid",
      className:
        "border-warning-solid bg-warning-solid text-warning-solid-foreground",
    },
    {
      tone: "destructive",
      variant: "weak",
      className:
        "border-destructive-foreground/25 bg-destructive text-destructive-foreground",
    },
    {
      tone: "destructive",
      variant: "solid",
      className:
        "border-destructive-solid bg-destructive-solid text-destructive-solid-foreground",
    },
  ],
  defaultVariants: {
    tone: "neutral",
    variant: "weak",
  },
})

function PageBanner({
  className,
  tone = "neutral",
  variant = "weak",
  ...props
}: React.ComponentProps<"section"> & VariantProps<typeof pageBannerVariants>) {
  return (
    <section
      data-slot="page-banner"
      className={cn(pageBannerVariants({ tone, variant }), className)}
      {...props}
    />
  )
}

function PageBannerContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-banner-content"
      className={cn("min-w-0 flex-1", className)}
      {...props}
    />
  )
}

function PageBannerTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="page-banner-title"
      className={cn("font-semibold", className)}
      {...props}
    />
  )
}

function PageBannerDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="page-banner-description"
      className={cn("mt-0.5 opacity-90", className)}
      {...props}
    />
  )
}

function PageBannerActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-banner-actions"
      className={cn("flex shrink-0 items-start gap-2", className)}
      {...props}
    />
  )
}

type PageBannerCloseProps = Omit<React.ComponentProps<"button">, "children"> & {
  label: string
}

function PageBannerClose({ className, label, ...props }: PageBannerCloseProps) {
  return (
    <button
      type="button"
      data-slot="page-banner-close"
      aria-label={label}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-sm transition-colors outline-none hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-current disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <XIcon aria-hidden="true" className="size-4" />
    </button>
  )
}

export {
  PageBanner,
  PageBannerActions,
  PageBannerClose,
  PageBannerContent,
  PageBannerDescription,
  PageBannerTitle,
  pageBannerVariants,
}
