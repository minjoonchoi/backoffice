import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { CircleHelpIcon } from "lucide-react"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const meta = {
  title: "Components/Navigation",
} satisfies Meta

export default meta
type Story = StoryObj

export const TabsVariants: Story = {
  render: () => (
    <div className="grid max-w-2xl gap-8">
      <Tabs defaultValue="requests">
        <TabsList aria-label="Request sections">
          <TabsTrigger value="requests">요청</TabsTrigger>
          <TabsTrigger value="history">처리 이력</TabsTrigger>
          <TabsTrigger value="policy">정책</TabsTrigger>
          <TabsTrigger value="disabled" disabled>
            통계
          </TabsTrigger>
        </TabsList>
        <TabsContent value="requests">검토 대기 요청 24건</TabsContent>
        <TabsContent value="history">오늘 처리한 요청 81건</TabsContent>
        <TabsContent value="policy">현재 적용 중인 정책 v3.4</TabsContent>
        <TabsContent value="disabled">사용할 수 없는 패널</TabsContent>
      </Tabs>

      <Tabs defaultValue="all">
        <TabsList variant="contained" aria-label="Status filter">
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="pending">대기</TabsTrigger>
          <TabsTrigger value="done">완료</TabsTrigger>
        </TabsList>
        <TabsContent value="all">전체 요청</TabsContent>
        <TabsContent value="pending">대기 중인 요청</TabsContent>
        <TabsContent value="done">완료된 요청</TabsContent>
      </Tabs>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const requests = canvas.getByRole("tab", { name: "요청" })
    const history = canvas.getByRole("tab", { name: "처리 이력" })

    requests.focus()
    await userEvent.keyboard("{ArrowRight}")
    await expect(history).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(history).toHaveAttribute("aria-selected", "true")
    await expect(canvas.getByText("오늘 처리한 요청 81건")).toBeVisible()
  },
}

export const TooltipInteraction: Story = {
  render: () => (
    <TooltipProvider delay={0}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="검토 기준 도움말"
            />
          }
        >
          <CircleHelpIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>승인 전에 최신 정책 버전을 확인하세요.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const documentBody = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole("button", { name: "검토 기준 도움말" })

    trigger.focus()
    const tooltip = await documentBody.findByRole("tooltip")
    await expect(tooltip).toHaveTextContent("최신 정책 버전")

    await userEvent.keyboard("{Escape}")
    await waitFor(() => {
      return expect(documentBody.queryByRole("tooltip")).not.toBeInTheDocument()
    })
  },
}
