"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon, MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "group/checkbox peer relative flex size-4 shrink-0 items-center justify-center rounded-sm border border-control-border bg-control text-primary-foreground transition-[background-color,border-color,box-shadow] outline-none after:absolute after:-inset-2 hover:border-control-border-hover focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive-foreground aria-invalid:ring-2 aria-invalid:ring-destructive-foreground data-checked:border-primary data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:bg-control-disabled data-disabled:opacity-50 data-indeterminate:border-primary data-indeterminate:bg-primary data-invalid:border-destructive-foreground data-invalid:ring-2 data-invalid:ring-destructive-foreground data-readonly:cursor-default data-readonly:bg-control-readonly",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current [&>svg]:size-3"
      >
        <CheckIcon className="group-data-indeterminate/checkbox:hidden" />
        <MinusIcon className="hidden group-data-indeterminate/checkbox:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
