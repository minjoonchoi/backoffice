import type { LucideIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type MetricCardBaseProps = {
  title: string
  value: number
  description?: string
  icon: LucideIcon
}

type MetricCardProps = MetricCardBaseProps &
  (
    | { actionLabel: string; onClick: () => void }
    | { actionLabel?: never; onClick?: never }
  )

function MetricCardContent({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: number
  description: string | undefined
  icon: LucideIcon
}) {
  return (
    <>
      <CardHeader className="flex grid-cols-[1fr_auto] items-center gap-3">
        <CardTitle className="text-body text-text-subtle">{title}</CardTitle>
        <span className="flex size-8 items-center justify-center rounded-md bg-brand-weak text-brand-weak-foreground">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </CardHeader>
      <CardContent>
        <p className="text-title font-semibold tabular-nums">{value}</p>
        {description ? (
          <p className="mt-1 text-caption text-text-subtle">{description}</p>
        ) : null}
      </CardContent>
    </>
  )
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  actionLabel,
  onClick,
}: MetricCardProps) {
  if (onClick) {
    if (!actionLabel) {
      throw new TypeError("An interactive metric card requires an action label")
    }
    return (
      <Card className="transition-colors hover:border-control-border-hover hover:bg-surface-subtle">
        <button
          type="button"
          aria-label={actionLabel}
          className="grid w-full rounded-card text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onClick}
        >
          <MetricCardContent
            title={title}
            value={value}
            description={description}
            icon={Icon}
          />
        </button>
      </Card>
    )
  }
  return (
    <Card>
      <MetricCardContent
        title={title}
        value={value}
        description={description}
        icon={Icon}
      />
    </Card>
  )
}
