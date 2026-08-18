"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import type * as React from "react"

import { cn } from "@/lib/utils"

function SidePanel<Payload = unknown>(
  props: DialogPrimitive.Root.Props<Payload>,
) {
  return <DialogPrimitive.Root data-slot="side-panel" {...props} />
}

function SidePanelTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="side-panel-trigger" {...props} />
}

function SidePanelClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="side-panel-close" {...props} />
}

function SidePanelOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="side-panel-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-overlay-backdrop duration-(--duration-moderate) data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 supports-backdrop-filter:backdrop-blur-xs",
        className,
      )}
      {...props}
    />
  )
}

type SidePanelContentProps = DialogPrimitive.Popup.Props & {
  side?: "left" | "right"
  size?: "sm" | "md" | "lg"
}

function SidePanelContent({
  className,
  side = "right",
  size = "md",
  children,
  ...props
}: SidePanelContentProps) {
  return (
    <DialogPrimitive.Portal>
      <SidePanelOverlay />
      <DialogPrimitive.Popup
        data-slot="side-panel-content"
        data-side={side}
        data-size={size}
        className={cn(
          "fixed inset-y-0 z-50 grid h-dvh w-full grid-rows-[auto_minmax(0,1fr)_auto] border-border bg-popover text-popover-foreground shadow-overlay duration-(--duration-slow) outline-none data-closed:animate-out data-open:animate-in",
          side === "right" &&
            "right-0 border-l data-closed:slide-out-to-right data-open:slide-in-from-right",
          side === "left" &&
            "left-0 border-r data-closed:slide-out-to-left data-open:slide-in-from-left",
          size === "sm" && "max-w-(--side-panel-width-sm)",
          size === "md" && "max-w-(--side-panel-width-md)",
          size === "lg" && "max-w-(--side-panel-width-lg)",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function SidePanelHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="side-panel-header"
      className={cn("grid gap-1 border-b border-border-subtle p-3", className)}
      {...props}
    />
  )
}

function SidePanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="side-panel-body"
      className={cn("min-h-0 overflow-y-auto p-3", className)}
      {...props}
    />
  )
}

function SidePanelFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="side-panel-footer"
      className={cn(
        "flex justify-end gap-2 border-t border-border-subtle bg-surface-subtle p-3",
        className,
      )}
      {...props}
    />
  )
}

function SidePanelTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="side-panel-title"
      className={cn("text-heading font-semibold text-text-strong", className)}
      {...props}
    />
  )
}

function SidePanelDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="side-panel-description"
      className={cn("text-body text-text-subtle", className)}
      {...props}
    />
  )
}

export {
  SidePanel,
  SidePanelBody,
  SidePanelClose,
  SidePanelContent,
  SidePanelDescription,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
  SidePanelTrigger,
}
