"use client"

import { Search } from "lucide-react"
import { useId, useMemo, useState } from "react"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

export type RequestTargetOption = {
  id: string
  title: string
  description?: string
  searchText?: string
}

export type RequestTargetSelectorProps = {
  label: string
  description: string
  searchLabel: string
  empty: string
  options: RequestTargetOption[]
  value: string | null
  onValueChange: (value: string) => void
  disabled?: boolean
  className?: string
  listClassName?: string
}

export function RequestTargetSelector({
  label,
  description,
  searchLabel,
  empty,
  options,
  value,
  onValueChange,
  disabled = false,
  className,
  listClassName,
}: RequestTargetSelectorProps) {
  const searchId = useId()
  const [query, setQuery] = useState("")
  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return options
    return options.filter((option) =>
      [option.title, option.description, option.searchText]
        .filter((item): item is string => Boolean(item))
        .some((item) => item.toLocaleLowerCase().includes(normalizedQuery)),
    )
  }, [options, query])

  return (
    <Field
      disabled={disabled}
      className={cn("grid-rows-[1.25rem_2.5rem_2rem_minmax(0,1fr)]", className)}
    >
      <span className="flex h-5 min-w-0 items-center overflow-hidden">
        <FieldLabel className="truncate" htmlFor={searchId}>
          {label}
        </FieldLabel>
      </span>
      <FieldDescription className="line-clamp-2 h-10 overflow-hidden">
        {description}
      </FieldDescription>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value)
          }}
          placeholder={searchLabel}
          className="pl-9"
          disabled={disabled}
        />
      </div>
      {visibleOptions.length > 0 ? (
        <RadioGroup
          aria-label={label}
          value={value ?? ""}
          onValueChange={onValueChange}
          disabled={disabled}
          className={cn(
            "max-h-56 auto-rows-max content-start overflow-y-auto rounded-lg border p-2",
            listClassName,
          )}
        >
          {visibleOptions.map((option) => {
            const optionId = `${searchId}-${option.id}`
            return (
              <label
                key={option.id}
                htmlFor={optionId}
                className="flex h-14 max-h-14 cursor-pointer items-start gap-3 overflow-hidden rounded-md px-3 py-2.5 hover:bg-surface-subtle"
              >
                <RadioGroupItem
                  id={optionId}
                  value={option.id}
                  className="mt-0.5"
                  disabled={disabled}
                />
                <span className="min-w-0 overflow-hidden">
                  <span className="block truncate text-sm font-medium">
                    {option.title}
                  </span>
                  {option.description ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </label>
            )
          })}
        </RadioGroup>
      ) : (
        <p
          className={cn(
            "grid place-items-center rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground",
            listClassName,
          )}
        >
          {empty}
        </p>
      )}
    </Field>
  )
}

export type RequestMultiTargetSelectorProps = Omit<
  RequestTargetSelectorProps,
  "value" | "onValueChange"
> & {
  value: readonly string[]
  selectedCountLabel: string
  onValueChange: (value: string[]) => void
}

export function RequestMultiTargetSelector({
  label,
  description,
  searchLabel,
  empty,
  options,
  value,
  selectedCountLabel,
  onValueChange,
  disabled = false,
  className,
  listClassName,
}: RequestMultiTargetSelectorProps) {
  const searchId = useId()
  const [query, setQuery] = useState("")
  const selectedIds = useMemo(() => new Set(value), [value])
  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return options
    return options.filter((option) =>
      [option.title, option.description, option.searchText]
        .filter((item): item is string => Boolean(item))
        .some((item) => item.toLocaleLowerCase().includes(normalizedQuery)),
    )
  }, [options, query])

  return (
    <Field
      disabled={disabled}
      className={cn("grid-rows-[1.25rem_2.5rem_2rem_minmax(0,1fr)]", className)}
    >
      <span className="flex h-5 min-w-0 items-center justify-between gap-3 overflow-hidden">
        <FieldLabel className="truncate" htmlFor={searchId}>
          {label}
        </FieldLabel>
        <Badge variant="secondary">{selectedCountLabel}</Badge>
      </span>
      <FieldDescription className="line-clamp-2 h-10 overflow-hidden">
        {description}
      </FieldDescription>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value)
          }}
          placeholder={searchLabel}
          className="pl-9"
          disabled={disabled}
        />
      </div>
      {visibleOptions.length > 0 ? (
        <fieldset
          className={cn(
            "grid max-h-64 auto-rows-max content-start gap-1 overflow-y-auto rounded-lg border p-2",
            listClassName,
          )}
        >
          <legend className="sr-only">{label}</legend>
          {visibleOptions.map((option) => {
            const optionId = `${searchId}-${option.id}`
            return (
              <label
                key={option.id}
                htmlFor={optionId}
                className="flex h-14 max-h-14 cursor-pointer items-start gap-3 overflow-hidden rounded-md px-3 py-2.5 hover:bg-surface-subtle"
              >
                <Checkbox
                  id={optionId}
                  checked={selectedIds.has(option.id)}
                  disabled={disabled}
                  onCheckedChange={(checked) => {
                    const next = new Set(selectedIds)
                    if (checked) next.add(option.id)
                    else next.delete(option.id)
                    onValueChange([...next])
                  }}
                  className="mt-0.5"
                />
                <span className="min-w-0 overflow-hidden">
                  <span className="block truncate text-sm font-medium">
                    {option.title}
                  </span>
                  {option.description ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </label>
            )
          })}
        </fieldset>
      ) : (
        <p
          className={cn(
            "grid place-items-center rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground",
            listClassName,
          )}
        >
          {empty}
        </p>
      )}
    </Field>
  )
}
