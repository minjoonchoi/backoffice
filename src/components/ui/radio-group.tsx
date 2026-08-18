"use client"

import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"

import { cn } from "@/lib/utils"

function RadioGroup<Value>({
  className,
  ...props
}: RadioGroupPrimitive.Props<Value>) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid w-full gap-2", className)}
      {...props}
    />
  )
}

function RadioGroupItem<Value>({
  className,
  ...props
}: RadioPrimitive.Root.Props<Value>) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-full border border-control-border bg-control transition-[background-color,border-color,box-shadow] outline-none after:absolute after:-inset-2 hover:border-control-border-hover focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive-foreground aria-invalid:ring-2 aria-invalid:ring-destructive-foreground data-checked:border-primary data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:bg-control-disabled data-disabled:opacity-50 data-invalid:border-destructive-foreground data-invalid:ring-2 data-invalid:ring-destructive-foreground data-readonly:cursor-default data-readonly:bg-control-readonly",
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="size-1.5 rounded-full bg-primary-foreground"
      />
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem }
