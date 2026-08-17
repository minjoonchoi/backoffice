import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

function DetailGrid({ className, ...props }: React.ComponentProps<"dl">) {
  return (
    <dl
      className={cn(
        "grid overflow-hidden rounded-card border border-border-subtle bg-surface sm:grid-cols-2",
        className,
      )}
      {...props}
    />
  )
}

type DetailItemProps = {
  label: string
  children: ReactNode
  className?: string
}

function DetailItem({ label, children, className }: DetailItemProps) {
  return (
    <div
      className={cn(
        "grid gap-1 border-b border-border-subtle p-3 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(2)]:border-b-0",
        className,
      )}
    >
      <dt className="text-caption font-medium text-text-subtle">{label}</dt>
      <dd className="min-w-0 text-body text-text-strong">{children}</dd>
    </div>
  )
}

export { DetailGrid, DetailItem }
