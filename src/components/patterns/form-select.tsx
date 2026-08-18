"use client"

import { useId } from "react"

import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type FormSelectOption<Value extends string> = Readonly<{
  label: string
  value: Value
}>

export function FormSelect<Value extends string>({
  label,
  value,
  onValueChange,
  options,
  disabled,
  error,
  onInteract,
}: {
  label: string
  value: Value | null
  onValueChange: (value: Value | null) => void
  options: readonly FormSelectOption<Value>[]
  disabled?: boolean
  error?: string | undefined
  onInteract?: (() => void) | undefined
}) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <Field disabled={disabled === true} invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        items={options}
        onValueChange={(nextValue) => {
          onInteract?.()
          onValueChange(nextValue)
        }}
        disabled={disabled === true}
      >
        <SelectTrigger
          id={id}
          className="w-full"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  )
}
