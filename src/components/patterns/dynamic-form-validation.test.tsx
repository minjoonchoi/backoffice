import { act, renderHook } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import messages from "../../../messages/ko.json"
import { useDynamicFormValidation } from "@/components/patterns/dynamic-form-validation"

function IntlWrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="ko" messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}

const formSchema = z.object({
  name: z.string().trim().min(2).max(10),
  targets: z.array(z.string()).min(1),
})

describe("useDynamicFormValidation", () => {
  it("hides untouched errors and updates a touched field dynamically", () => {
    const invalid = formSchema.safeParse({ name: "", targets: [] })
    expect(invalid.success).toBe(false)
    if (invalid.success) return

    const { result } = renderHook(
      () => useDynamicFormValidation(invalid.error),
      { wrapper: IntlWrapper },
    )

    expect(result.current.getFieldValidation("name", "name-error")).toEqual({
      error: undefined,
      errorId: undefined,
      invalid: false,
    })

    act(() => {
      result.current.touch("name")
    })

    expect(result.current.getFieldValidation("name", "name-error")).toEqual({
      error: "2자 이상 입력해 주세요.",
      errorId: "name-error",
      invalid: true,
    })
    expect(
      result.current.getFieldValidation("targets", "targets-error").invalid,
    ).toBe(false)
  })

  it("reveals every invalid field when submission is attempted", () => {
    const invalid = formSchema.safeParse({ name: "", targets: [] })
    expect(invalid.success).toBe(false)
    if (invalid.success) return

    const { result } = renderHook(
      () => useDynamicFormValidation(invalid.error),
      { wrapper: IntlWrapper },
    )

    act(() => {
      result.current.revealAll()
    })

    expect(
      result.current.getFieldValidation("name", "name-error").invalid,
    ).toBe(true)
    expect(
      result.current.getFieldValidation("targets", "targets-error"),
    ).toEqual({
      error: "1개 이상 선택해 주세요.",
      errorId: "targets-error",
      invalid: true,
    })
  })
})
