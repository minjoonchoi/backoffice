"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border border-control-border bg-control-active transition-[background-color,border-color,box-shadow] outline-none after:absolute after:-inset-2 hover:border-control-border-hover focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive-foreground aria-invalid:ring-2 aria-invalid:ring-destructive-foreground data-checked:border-primary data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50 data-invalid:border-destructive-foreground data-invalid:ring-2 data-invalid:ring-destructive-foreground data-readonly:cursor-default",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-3.5 translate-x-px rounded-full bg-control shadow-sm transition-transform data-checked:translate-x-[15px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
