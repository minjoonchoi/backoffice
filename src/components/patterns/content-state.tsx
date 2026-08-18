import { AlertCircle, Inbox, LoaderCircle } from "lucide-react"
import type { ComponentType, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  ResultSection,
  ResultSectionActions,
  ResultSectionDescription,
  ResultSectionHeader,
  ResultSectionMedia,
  ResultSectionTitle,
} from "@/components/ui/result-section"
import { cn } from "@/lib/utils"

type StatePanelProps = {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  title: string
  description: string
  action?: ReactNode
  className?: string | undefined
  busy?: boolean
  role?: "status" | "alert"
}

function StatePanel({
  icon: Icon,
  title,
  description,
  action,
  className,
  busy,
  role = "status",
}: StatePanelProps) {
  return (
    <ResultSection
      role={role}
      aria-busy={busy}
      className={cn(
        "min-h-56 rounded-card border border-dashed bg-card",
        className,
      )}
    >
      <ResultSectionMedia
        className={
          role === "alert"
            ? "bg-destructive text-destructive-foreground"
            : undefined
        }
      >
        <Icon className={cn("size-5", busy && "animate-spin")} aria-hidden />
      </ResultSectionMedia>
      <ResultSectionHeader>
        <ResultSectionTitle>{title}</ResultSectionTitle>
        <ResultSectionDescription>{description}</ResultSectionDescription>
      </ResultSectionHeader>
      {action ? <ResultSectionActions>{action}</ResultSectionActions> : null}
    </ResultSection>
  )
}

export function LoadingState(
  props: Pick<StatePanelProps, "title" | "description" | "className">,
) {
  return <StatePanel icon={LoaderCircle} busy {...props} />
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: Pick<StatePanelProps, "title" | "description" | "action" | "className">) {
  return (
    <StatePanel
      icon={Inbox}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  )
}

export type ErrorStateProps = Pick<
  StatePanelProps,
  "title" | "description" | "className"
> & {
  retryLabel?: string
  onRetry?: () => void
}

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  className,
}: ErrorStateProps) {
  const action =
    retryLabel && onRetry ? (
      <Button variant="outline" onClick={onRetry}>
        {retryLabel}
      </Button>
    ) : undefined

  return (
    <StatePanel
      icon={AlertCircle}
      title={title}
      description={description}
      action={action}
      className={className}
      role="alert"
    />
  )
}
