"use client"

import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"

import {
  FormDialog,
  FormDialogContent,
} from "@/components/patterns/form-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import type { BackofficeErrorCode, CommandResult } from "@/domain/common"
import { CommandErrorMessage } from "@/application/ui/backoffice-ui"

export type AssignmentOption = {
  id: string
  title: string
  description?: string
  searchText?: string
}

const ASSIGNMENT_PAGE_SIZE = 5

type AssignmentDialogProps = {
  triggerLabel: string
  title: string
  description: string
  searchLabel: string
  options: AssignmentOption[]
  successMessage: string
  onAssign: (ids: string[]) => Promise<CommandResult<unknown>>
}

export function AssignmentDialog({
  triggerLabel,
  title,
  description,
  searchLabel,
  options,
  successMessage,
  onAssign,
}: AssignmentDialogProps) {
  const common = useTranslations("backoffice.common")
  const searchId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<BackofficeErrorCode>()
  const [isAssigning, setIsAssigning] = useState(false)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredOptions = options.filter((option) =>
    (option.searchText ?? option.title)
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  )
  const pageCount = Math.max(
    1,
    Math.ceil(filteredOptions.length / ASSIGNMENT_PAGE_SIZE),
  )
  const currentPage = Math.min(page, pageCount)
  const visibleOptions = filteredOptions.slice(
    (currentPage - 1) * ASSIGNMENT_PAGE_SIZE,
    currentPage * ASSIGNMENT_PAGE_SIZE,
  )

  async function assign() {
    setIsAssigning(true)
    try {
      const result = await onAssign([...selectedIds])
      if (!result.ok) {
        setError(result.error)
        return
      }
      snackbar.success(successMessage)
      setOpen(false)
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <FormDialog
      open={open}
      hasChanges={selectedIds.size > 0}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        setQuery("")
        setPage(1)
        setSelectedIds(new Set())
        setError(undefined)
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" disabled={options.length === 0} />
        }
      >
        <Plus />
        {triggerLabel}
      </DialogTrigger>
      <FormDialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={searchId}>{searchLabel}</FieldLabel>
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
        </Field>
        <fieldset className="grid max-h-80 gap-1 overflow-y-auto rounded-lg border p-2">
          <legend className="sr-only">{title}</legend>
          {visibleOptions.length ? (
            visibleOptions.map((option) => (
              <label
                key={option.id}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
              >
                <Checkbox
                  checked={selectedIds.has(option.id)}
                  onCheckedChange={(checked) => {
                    setSelectedIds((current) => {
                      const next = new Set(current)
                      if (checked) next.add(option.id)
                      else next.delete(option.id)
                      return next
                    })
                  }}
                  aria-label={option.title}
                />
                <span className="grid min-w-0 gap-0.5">
                  <span className="font-medium">{option.title}</span>
                  {option.description ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </label>
            ))
          ) : (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {common("noResults")}
            </p>
          )}
        </fieldset>
        {pageCount > 1 ? (
          <nav
            aria-label={common("pagination")}
            className="flex items-center justify-between gap-3"
          >
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {common("paginationStatus", {
                current: currentPage,
                total: pageCount,
              })}
            </p>
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => {
                  setPage(currentPage - 1)
                }}
              >
                {common("previous")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage === pageCount}
                onClick={() => {
                  setPage(currentPage + 1)
                }}
              >
                {common("next")}
              </Button>
            </div>
          </nav>
        ) : null}
        <CommandErrorMessage error={error} />
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {common("cancel")}
          </DialogClose>
          <Button
            type="button"
            disabled={selectedIds.size === 0 || isAssigning}
            aria-busy={isAssigning}
            onClick={() => void assign()}
          >
            {triggerLabel}
          </Button>
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}
