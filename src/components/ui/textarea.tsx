import type * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content min-h-20 w-full resize-y rounded-control border border-control-border bg-control px-2.5 py-2 text-base transition-[background-color,border-color,box-shadow] outline-none placeholder:text-muted-foreground read-only:bg-control-readonly read-only:text-muted-foreground hover:border-control-border-hover focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-control-disabled disabled:text-muted-foreground disabled:opacity-100 aria-invalid:border-destructive-foreground aria-invalid:ring-2 aria-invalid:ring-destructive-foreground md:text-sm",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
