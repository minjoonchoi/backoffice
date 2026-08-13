import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { RelationshipRemoveAction } from "@/application/ui/relationship-remove-action"

const meta = {
  title: "Backoffice/RelationshipRemoveAction",
  component: RelationshipRemoveAction,
} satisfies Meta<typeof RelationshipRemoveAction>

export default meta
type Story = StoryObj<typeof meta>

export const ConfirmRemoval: Story = {
  args: {
    subjectName: "개발 1팀",
    targetName: "David",
    onRemove: () => Promise.resolve({ ok: true, value: undefined }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      canvas.getByRole("button", { name: "David 연결 제거" }),
    )
    await waitFor(async () => {
      await expect(body.getByRole("alertdialog")).toBeVisible()
      await expect(
        body.getByText(
          "개발 1팀 — David 연결을 제거합니다. 필요하면 다시 추가할 수 있습니다.",
        ),
      ).toBeVisible()
    })
    await userEvent.click(body.getByRole("button", { name: "제거" }))
    await waitFor(async () => {
      await expect(body.queryByRole("alertdialog")).not.toBeInTheDocument()
      await expect(body.getByText("David 연결을 제거했습니다.")).toBeVisible()
    })
  },
}

export const Protected: Story = {
  args: {
    subjectName: "사용자 관리",
    targetName: "Backoffice 시스템 관리자",
    disabled: true,
    onRemove: () => Promise.resolve({ ok: true, value: undefined }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("button", {
        name: "Backoffice 시스템 관리자 연결 제거",
      }),
    ).toBeDisabled()
  },
}
