import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  SidePanel,
  SidePanelBody,
  SidePanelClose,
  SidePanelContent,
  SidePanelDescription,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
  SidePanelTrigger,
} from "@/components/ui/side-panel"

const meta = {
  title: "Components/Side Panel",
} satisfies Meta

export default meta
type Story = StoryObj

function SidePanelFixture({ side = "right" }: { side?: "left" | "right" }) {
  return (
    <SidePanel>
      <SidePanelTrigger render={<Button />}>작업 상세 열기</SidePanelTrigger>
      <SidePanelContent side={side}>
        <SidePanelHeader>
          <SidePanelTitle>작업 #4182</SidePanelTitle>
          <SidePanelDescription>
            현재 목록 맥락을 유지하며 세부 정보를 검토합니다.
          </SidePanelDescription>
        </SidePanelHeader>
        <SidePanelBody className="grid content-start gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={`side-panel-owner-${side}`}>담당자</Label>
            <Input id={`side-panel-owner-${side}`} defaultValue="김민준" />
          </div>
          {Array.from({ length: 8 }, (_, index) => (
            <section key={index} className="rounded-card border p-3">
              <h3 className="font-medium">검토 항목 {index + 1}</h3>
              <p className="mt-1 text-body text-text-subtle">
                요청 내용과 변경 이력을 확인하세요.
              </p>
            </section>
          ))}
        </SidePanelBody>
        <SidePanelFooter>
          <SidePanelClose render={<Button variant="outline" />}>
            취소
          </SidePanelClose>
          <SidePanelClose render={<Button />}>저장</SidePanelClose>
        </SidePanelFooter>
      </SidePanelContent>
    </SidePanel>
  )
}

export const RightPanelInteraction: Story = {
  render: () => <SidePanelFixture />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole("button", { name: "작업 상세 열기" })

    trigger.focus()
    await userEvent.keyboard("{Enter}")
    const dialog = await body.findByRole("dialog")
    await expect(dialog).toBeVisible()
    await waitFor(() =>
      expect(dialog.contains(dialog.ownerDocument.activeElement)).toBe(true),
    )

    await userEvent.tab()
    await expect(dialog.contains(dialog.ownerDocument.activeElement)).toBe(true)
    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    await expect(trigger).toHaveFocus()
  },
}

export const LeftPanel: Story = {
  render: () => <SidePanelFixture side="left" />,
}

export const SidePanelKeyboardFixture: Story = {
  render: () => <SidePanelFixture />,
}
