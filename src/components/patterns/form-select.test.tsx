import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { FormSelect } from "@/components/patterns/form-select"

describe("FormSelect", () => {
  it("renders the selected option with the current locale label", () => {
    const onValueChange = vi.fn()
    const { rerender } = render(
      <FormSelect
        label="재직 상태"
        value="employed"
        onValueChange={onValueChange}
        options={[
          { value: "employed", label: "재직" },
          { value: "on-leave", label: "휴직" },
        ]}
      />,
    )

    expect(
      screen.getByRole("combobox", { name: "재직 상태" }),
    ).toHaveTextContent("재직")

    rerender(
      <FormSelect
        label="Employment status"
        value="employed"
        onValueChange={onValueChange}
        options={[
          { value: "employed", label: "Employed" },
          { value: "on-leave", label: "On leave" },
        ]}
      />,
    )

    expect(
      screen.getByRole("combobox", { name: "Employment status" }),
    ).toHaveTextContent("Employed")
  })

  it("connects a dynamic error message to the trigger", () => {
    render(
      <FormSelect
        label="요청 유형"
        value={null}
        onValueChange={vi.fn()}
        options={[{ value: "credential", label: "자격증명" }]}
        error="필수 입력 항목입니다."
      />,
    )

    const trigger = screen.getByRole("combobox", { name: "요청 유형" })
    const error = screen.getByText("필수 입력 항목입니다.")
    expect(trigger).toHaveAttribute("aria-invalid", "true")
    expect(trigger).toHaveAttribute("aria-describedby", error.id)
    expect(error).toHaveAttribute("role", "alert")
  })
})
