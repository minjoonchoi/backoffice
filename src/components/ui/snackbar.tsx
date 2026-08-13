"use client"

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  InfoIcon,
  LoaderCircleIcon,
  XCircleIcon,
} from "lucide-react"
import { Toaster, toast, type ToasterProps } from "sonner"

function SnackbarProvider(props: ToasterProps) {
  return (
    <Toaster
      position="bottom-right"
      theme="light"
      gap={8}
      icons={{
        success: <CheckCircle2Icon aria-hidden="true" className="size-4" />,
        info: <InfoIcon aria-hidden="true" className="size-4" />,
        warning: <AlertTriangleIcon aria-hidden="true" className="size-4" />,
        error: <XCircleIcon aria-hidden="true" className="size-4" />,
        loading: (
          <LoaderCircleIcon
            aria-hidden="true"
            className="size-4 animate-spin"
          />
        ),
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "pointer-events-none flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-overlay border border-border bg-popover p-3 text-body text-popover-foreground shadow-overlay",
          content: "grid min-w-0 flex-1 gap-0.5",
          title: "font-medium text-text-strong",
          description: "text-text-subtle",
          icon: "mt-0.5 text-text-subtle",
          success:
            "border-success-foreground/30 [&_[data-icon]]:text-success-foreground",
          info: "border-info-foreground/30 [&_[data-icon]]:text-info-foreground",
          warning:
            "border-warning-foreground/30 [&_[data-icon]]:text-warning-foreground",
          error:
            "border-destructive-foreground/30 [&_[data-icon]]:text-destructive-foreground",
          actionButton:
            "pointer-events-auto ml-auto h-control-sm shrink-0 rounded-sm px-2 text-caption font-semibold text-brand-weak-foreground outline-none hover:bg-brand-weak focus-visible:ring-2 focus-visible:ring-ring",
          cancelButton:
            "pointer-events-auto ml-auto h-control-sm shrink-0 rounded-sm px-2 text-caption font-semibold text-text-subtle outline-none hover:bg-control-hover focus-visible:ring-2 focus-visible:ring-ring",
          closeButton:
            "pointer-events-auto inline-flex size-control-sm shrink-0 items-center justify-center rounded-sm border bg-surface outline-none hover:bg-control-hover focus-visible:ring-2 focus-visible:ring-ring",
        },
      }}
      {...props}
    />
  )
}

const snackbar = toast

export { SnackbarProvider, snackbar }
