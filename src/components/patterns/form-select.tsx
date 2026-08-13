"use client"

import { useId } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
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
}: {
  label: string
  value: Value | null
  onValueChange: (value: Value | null) => void
  options: readonly FormSelectOption<Value>[]
  disabled?: boolean
}) {
  const id = useId()
  return (
    <Field disabled={disabled === true}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        items={options}
        onValueChange={onValueChange}
        disabled={disabled === true}
      >
        <SelectTrigger id={id} className="w-full">
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
    </Field>
  )
}
