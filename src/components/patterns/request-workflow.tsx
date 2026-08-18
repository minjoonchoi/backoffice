"use client"

import Link from "next/link"
import { useId, type ReactNode } from "react"

import { PageHeader } from "@/components/patterns/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"

type RequestWorkflowProps = {
  title: string
  description: string
  children: ReactNode
  cancelLabel: string
  cancelHref: string
  previousLabel?: string | undefined
  secondaryLabel?: string | undefined
  submitLabel: string
  submitDisabled?: boolean
  secondaryDisabled?: boolean
  onPrevious?: () => void
  onSecondary?: () => void
  onSubmit: (form: HTMLFormElement) => void
}

export function RequestWorkflow({
  title,
  description,
  children,
  cancelLabel,
  cancelHref,
  previousLabel,
  secondaryLabel,
  submitLabel,
  submitDisabled = false,
  secondaryDisabled = false,
  onPrevious,
  onSecondary,
  onSubmit,
}: RequestWorkflowProps) {
  const formId = useId()

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4">
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent>
          <form
            id={formId}
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              onSubmit(event.currentTarget)
            }}
          >
            {children}
          </form>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            render={<Link href={cancelHref} />}
          >
            {cancelLabel}
          </Button>
          {previousLabel && onPrevious ? (
            <Button type="button" variant="outline" onClick={onPrevious}>
              {previousLabel}
            </Button>
          ) : null}
          {secondaryLabel && onSecondary ? (
            <Button
              type="button"
              variant="outline"
              disabled={secondaryDisabled}
              onClick={onSecondary}
            >
              {secondaryLabel}
            </Button>
          ) : null}
          <Button type="submit" form={formId} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
