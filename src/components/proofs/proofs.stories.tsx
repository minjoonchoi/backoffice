import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"
import { delay, http, HttpResponse } from "msw"

import { FormProof } from "@/components/proofs/form-proof"
import { QueryProof } from "@/components/proofs/query-proof"
import { TableProof } from "@/components/proofs/table-proof"

const meta = {
  title: "Proofs/Integration",
  component: FormProof,
} satisfies Meta<typeof FormProof>

export default meta
type Story = StoryObj<typeof meta>

export const Form: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: /이름|name/i })
    await userEvent.type(input, "A")
    await userEvent.click(canvas.getByRole("button", { name: /저장|save/i }))
    await expect(canvas.getByRole("alert")).toBeVisible()
    await userEvent.clear(input)
    await userEvent.type(input, "Admin")
    await userEvent.click(canvas.getByRole("button", { name: /저장|save/i }))
    await expect(canvas.getByRole("status")).toBeVisible()
  },
}

export const Table: Story = {
  render: () => <TableProof />,
}

export const Query: Story = {
  render: () => <QueryProof />,
  beforeEach: ({ msw }) => {
    msw.use(
      http.get("/api/foundation/status", async () => {
        await delay(30)
        return HttpResponse.json({ status: "ready" })
      }),
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText(
        /API 경계가 응답했습니다|API boundary responded/i,
      ),
    ).toBeVisible()
  },
}
