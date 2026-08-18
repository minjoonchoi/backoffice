import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { BellIcon, ClockIcon, FilterIcon, UserIcon } from "lucide-react"
import { expect, userEvent, within } from "storybook/test"

import {
  Accordion,
  AccordionContent,
  AccordionDescription,
  AccordionItem,
  AccordionTitle,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Chip, ChipGroup } from "@/components/ui/chip"
import { NotificationBadge } from "@/components/ui/notification-badge"
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control"
import { TagGroup, TagItem, TagSeparator } from "@/components/ui/tag-group"

const meta = {
  title: "Components/Selection & Metadata",
} satisfies Meta

export default meta
type Story = StoryObj

export const AccordionStates: Story = {
  render: () => (
    <div className="grid max-w-2xl gap-6">
      <Accordion defaultValue={["policy"]}>
        <AccordionItem value="policy">
          <AccordionTrigger>
            <AccordionTitle>승인 정책</AccordionTitle>
            <AccordionDescription>
              자동 승인과 수동 검토 기준
            </AccordionDescription>
          </AccordionTrigger>
          <AccordionContent>
            위험 점수가 70 이상인 요청은 담당자의 수동 검토가 필요합니다.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="audit">
          <AccordionTrigger>
            <AccordionTitle>감사 로그</AccordionTitle>
          </AccordionTrigger>
          <AccordionContent>
            모든 변경은 작업자, 시각, 변경 전후 값과 함께 기록됩니다.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="disabled" disabled>
          <AccordionTrigger>
            <AccordionTitle>사용할 수 없는 정책</AccordionTitle>
          </AccordionTrigger>
          <AccordionContent>이 내용은 열 수 없습니다.</AccordionContent>
        </AccordionItem>
      </Accordion>

      <Accordion variant="separated" multiple>
        <AccordionItem value="one">
          <AccordionTrigger>
            <AccordionTitle>분리형 첫 항목</AccordionTitle>
          </AccordionTrigger>
          <AccordionContent>
            여러 항목을 동시에 열 수 있습니다.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="two">
          <AccordionTrigger>
            <AccordionTitle>분리형 두 번째 항목</AccordionTitle>
          </AccordionTrigger>
          <AccordionContent>복잡한 설정 묶음에 사용합니다.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const audit = canvas.getByRole("button", { name: "감사 로그" })
    await userEvent.click(audit)
    await expect(audit).toHaveAttribute("aria-expanded", "true")
    await expect(canvas.getByText(/모든 변경은/)).toBeVisible()

    const disabled = canvas.getByRole("button", {
      name: "사용할 수 없는 정책",
    })
    await expect(disabled).toHaveAttribute("aria-disabled", "true")
  },
}

export const ChipStates: Story = {
  render: () => (
    <div className="grid gap-5">
      <ChipGroup
        defaultValue={["waiting"]}
        multiple
        aria-label="처리 상태 필터"
      >
        <Chip value="all" variant="solid">
          전체
        </Chip>
        <Chip value="waiting">대기</Chip>
        <Chip value="reviewing">검토 중</Chip>
        <Chip value="done">완료</Chip>
        <Chip value="disabled" disabled>
          보관됨
        </Chip>
      </ChipGroup>
      <div className="flex flex-wrap items-center gap-2">
        <Chip size="sm" variant="outlineWeak" defaultPressed>
          Small selected
        </Chip>
        <Chip variant="outlineStrong">Default</Chip>
        <Chip size="lg" variant="solid">
          <FilterIcon aria-hidden="true" /> Large
        </Chip>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const reviewing = canvas.getByRole("button", { name: "검토 중" })
    await userEvent.click(reviewing)
    await expect(reviewing).toHaveAttribute("aria-pressed", "true")
  },
}

export const SegmentedControlKeyboard: Story = {
  render: () => (
    <SegmentedControl defaultValue="day" name="period" aria-label="집계 기간">
      <SegmentedControlItem value="day">일간</SegmentedControlItem>
      <SegmentedControlItem value="week">주간</SegmentedControlItem>
      <SegmentedControlItem value="month">월간</SegmentedControlItem>
      <SegmentedControlItem value="year" disabled>
        연간
      </SegmentedControlItem>
    </SegmentedControl>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const day = canvas.getByRole("radio", { name: "일간" })
    const week = canvas.getByRole("radio", { name: "주간" })
    day.focus()
    await userEvent.keyboard("{ArrowRight}")
    await expect(week).toBeChecked()
    await expect(week).toHaveFocus()
  },
}

export const NotificationAndTags: Story = {
  render: () => (
    <div className="grid gap-6">
      <div className="flex items-center gap-8">
        <span className="relative inline-flex">
          <BellIcon aria-hidden="true" className="size-6" />
          <NotificationBadge
            className="absolute -top-1 -right-1"
            aria-label="새 알림 있음"
          />
        </span>
        <span className="relative inline-flex">
          <UserIcon aria-hidden="true" className="size-6" />
          <NotificationBadge
            variant="count"
            value={128}
            className="absolute -top-2 -right-4"
            aria-label="읽지 않은 알림 99개 이상"
          />
        </span>
      </div>
      <TagGroup aria-label="요청 메타데이터">
        <TagItem tone="brand" weight="strong">
          요청 #4182
        </TagItem>
        <TagSeparator />
        <TagItem>
          <UserIcon aria-hidden="true" /> 김민준
        </TagItem>
        <TagSeparator />
        <TagItem tone="subtle">
          <ClockIcon aria-hidden="true" /> 12분 전
        </TagItem>
      </TagGroup>
    </div>
  ),
}
