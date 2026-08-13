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
})
