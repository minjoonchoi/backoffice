"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"
import type * as React from "react"
import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function DialogFocusGuardNames() {
  const markerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const popup = markerRef.current?.closest("[data-slot='dialog-content']")
    const portal = popup?.parentElement
    if (!popup || !portal) return
    const namedGuards = new Set<Element>()
    let labelledBy: string | null = null

    function clearFocusGuardNames() {
      for (const guard of namedGuards) {
        if (guard.getAttribute("aria-labelledby") === labelledBy) {
          guard.removeAttribute("aria-labelledby")
        }
      }
      namedGuards.clear()
      labelledBy = null
    }

    function nameFocusGuards() {
      const descriptionId = popup?.getAttribute("aria-describedby")
      if (!descriptionId) return
      labelledBy = descriptionId
      for (const guard of portal?.querySelectorAll(
        "[data-base-ui-focus-guard]",
      ) ?? []) {
        guard.setAttribute("aria-labelledby", descriptionId)
        namedGuards.add(guard)
      }
    }

    function syncFocusGuards() {
      if (popup?.hasAttribute("data-closed")) {
        clearFocusGuardNames()
        return
      }
      nameFocusGuards()
    }

    const observer = new MutationObserver(syncFocusGuards)
    observer.observe(portal, {
      attributes: true,
      attributeFilter: ["aria-describedby", "data-open", "data-closed"],
      childList: true,
      subtree: true,
    })
    syncFocusGuards()
    return () => {
      observer.disconnect()
      clearFocusGuardNames()
    }
  }, [])

  return <span ref={markerRef} hidden />
}

function Dialog<Payload = unknown>(props: DialogPrimitive.Root.Props<Payload>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-overlay-backdrop duration-(--duration-fast) data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 supports-backdrop-filter:backdrop-blur-xs",
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & { showCloseButton?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-3 overflow-y-auto rounded-overlay border bg-popover p-3 text-body text-popover-foreground shadow-overlay duration-(--duration-fast) outline-none data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
          className,
        )}
        {...props}
      >
        {children}
        <DialogFocusGuardNames />
        {showCloseButton ? (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-2 right-2"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close dialog</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("grid gap-1 pr-8", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-3 -mb-3 flex flex-col-reverse gap-2 rounded-b-overlay border-t bg-surface-subtle p-3 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-sm leading-snug font-medium", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-body text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}
