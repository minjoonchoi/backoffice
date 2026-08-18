"use client"

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function ChipGroup<Value extends string>({
  className,
  ...props
}: ToggleGroupPrimitive.Props<Value>) {
  return (
    <ToggleGroupPrimitive
      data-slot="chip-group"
      className={cn("flex flex-wrap gap-2", className)}
      {...props}
    />
  )
}

const chipVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border text-body font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        solid:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-accent data-pressed:bg-brand data-pressed:text-brand-foreground",
        outlineStrong:
          "border-control-border bg-control text-foreground hover:border-control-border-hover hover:bg-control-hover data-pressed:border-stroke-brand data-pressed:bg-brand-weak data-pressed:text-brand-weak-foreground",
        outlineWeak:
          "border-border-subtle bg-surface text-text-subtle hover:bg-control-hover data-pressed:border-stroke-brand data-pressed:bg-brand-weak data-pressed:text-brand-weak-foreground",
      },
      size: {
        sm: "h-control-sm px-2 text-caption",
        default: "h-control px-3",
        lg: "h-control-lg px-3.5",
      },
    },
    defaultVariants: {
      variant: "outlineStrong",
      size: "default",
    },
  },
)

function Chip<Value extends string>({
  className,
  variant = "outlineStrong",
  size = "default",
  ...props
}: TogglePrimitive.Props<Value> & VariantProps<typeof chipVariants>) {
  return (
    <TogglePrimitive
      data-slot="chip"
      className={cn(chipVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Chip, ChipGroup, chipVariants }
