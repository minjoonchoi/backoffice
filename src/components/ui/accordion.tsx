"use client"

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { ChevronDownIcon } from "lucide-react"
import type * as React from "react"

import { cn } from "@/lib/utils"

type AccordionProps<Value> = AccordionPrimitive.Root.Props<Value> & {
  variant?: "inline" | "separated"
}

function Accordion<Value>({
  className,
  variant = "inline",
  ...props
}: AccordionProps<Value>) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      data-variant={variant}
      className={cn(
        "grid w-full gap-2",
        variant === "inline" &&
          "gap-0 rounded-card border bg-surface [&>[data-slot=accordion-item]]:border-b [&>[data-slot=accordion-item]]:border-border-subtle [&>[data-slot=accordion-item]:last-child]:border-b-0",
        variant === "separated" &&
          "[&>[data-slot=accordion-item]]:rounded-card [&>[data-slot=accordion-item]]:border [&>[data-slot=accordion-item]]:shadow-card",
        className,
      )}
      {...props}
    />
  )
}

type AccordionItemProps = Omit<AccordionPrimitive.Item.Props, "value"> & {
  value?: string | number
}

function AccordionItem({ className, ...props }: AccordionItemProps) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("group/accordion-item bg-surface", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header>
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "flex min-h-10 w-full items-center gap-2 rounded-[inherit] px-3 py-2 text-left text-body transition-colors outline-none hover:bg-control-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-disabled:cursor-not-allowed data-disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <span className="min-w-0 flex-1">{children}</span>
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-text-subtle transition-transform duration-(--duration-moderate) group-data-open/accordion-item:rotate-180"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionTitle({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="accordion-title"
      className={cn("block font-medium text-text-strong", className)}
      {...props}
    />
  )
}

function AccordionDescription({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="accordion-description"
      className={cn("mt-0.5 block text-caption text-text-subtle", className)}
      {...props}
    />
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="h-(--accordion-panel-height) overflow-hidden transition-[height] duration-(--duration-moderate) ease-(--ease-standard) data-ending-style:h-0 data-starting-style:h-0"
      {...props}
    >
      <div className={cn("px-3 pb-3 text-body text-text-subtle", className)}>
        {children}
      </div>
    </AccordionPrimitive.Panel>
  )
}

export {
  Accordion,
  AccordionContent,
  AccordionDescription,
  AccordionItem,
  AccordionTitle,
  AccordionTrigger,
}
