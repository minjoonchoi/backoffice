"use client"

import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"

import { cn } from "@/lib/utils"

function SegmentedControl<Value>({
  className,
  ...props
}: RadioGroupPrimitive.Props<Value>) {
  return (
    <RadioGroupPrimitive
      data-slot="segmented-control"
      className={cn(
        "inline-flex min-w-0 items-center gap-0.5 rounded-control bg-secondary p-0.5",
        className,
      )}
      {...props}
    />
  )
}

function SegmentedControlItem<Value>({
  className,
  ...props
}: RadioPrimitive.Root.Props<Value>) {
  return (
    <RadioPrimitive.Root
      data-slot="segmented-control-item"
      className={cn(
        "relative inline-flex h-control min-w-16 items-center justify-center gap-1.5 rounded-sm px-3 text-body font-medium text-text-subtle transition-[color,background-color,box-shadow] outline-none after:absolute after:-inset-0.5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-checked:bg-surface data-checked:text-brand-weak-foreground data-checked:shadow-card data-disabled:cursor-not-allowed data-disabled:opacity-50 data-readonly:cursor-default [&_svg]:size-3.5",
        className,
      )}
      {...props}
    />
  )
}

export { SegmentedControl, SegmentedControlItem }
