import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type FilterBarProps = {
  label: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}

export function FilterBar({
  label,
  children,
  actions,
  className,
}: FilterBarProps) {
  return (
    <section
      aria-label={label}
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </section>
  )
}
