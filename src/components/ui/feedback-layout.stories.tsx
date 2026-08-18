import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  InfoIcon,
  SearchXIcon,
} from "lucide-react"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { Button } from "@/components/ui/button"
import { ContentPlaceholder } from "@/components/ui/content-placeholder"
import {
  PageBanner,
  PageBannerActions,
  PageBannerClose,
  PageBannerContent,
  PageBannerDescription,
  PageBannerTitle,
} from "@/components/ui/page-banner"
import {
  ResultSection,
  ResultSectionActions,
  ResultSectionDescription,
  ResultSectionHeader,
  ResultSectionMedia,
  ResultSectionTitle,
} from "@/components/ui/result-section"
import { snackbar } from "@/components/ui/snackbar"

const meta = {
  title: "Components/Feedback & Layout",
} satisfies Meta

export default meta
type Story = StoryObj

export const PageBannerVariants: Story = {
  render: () => (
    <div className="grid max-w-4xl gap-3">
      <PageBanner>
        <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <PageBannerContent>
          <PageBannerTitle>운영 정책이 변경되었습니다.</PageBannerTitle>
          <PageBannerDescription>
            오늘 접수된 요청부터 새 승인 기준이 적용됩니다.
          </PageBannerDescription>
        </PageBannerContent>
        <PageBannerActions>
          <Button variant="ghost" size="sm">
            정책 보기
          </Button>
          <PageBannerClose label="배너 닫기" />
        </PageBannerActions>
      </PageBanner>
      <PageBanner tone="success">
        <CheckCircle2Icon aria-hidden="true" className="mt-0.5 size-4" />
        <PageBannerContent>
          <PageBannerTitle>데이터 동기화를 완료했습니다.</PageBannerTitle>
        </PageBannerContent>
      </PageBanner>
      <PageBanner tone="warning" variant="solid">
        <AlertTriangleIcon aria-hidden="true" className="mt-0.5 size-4" />
        <PageBannerContent>
          <PageBannerTitle>처리 기한이 2시간 남았습니다.</PageBannerTitle>
        </PageBannerContent>
      </PageBanner>
      <PageBanner tone="destructive">
        <AlertTriangleIcon aria-hidden="true" className="mt-0.5 size-4" />
        <PageBannerContent>
          <PageBannerTitle>정산 파일을 불러오지 못했습니다.</PageBannerTitle>
        </PageBannerContent>
      </PageBanner>
    </div>
  ),
}

export const ResultAndPlaceholder: Story = {
  render: () => (
    <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
      <ResultSection className="rounded-card border bg-surface">
        <ResultSectionMedia>
          <SearchXIcon aria-hidden="true" />
        </ResultSectionMedia>
        <ResultSectionHeader>
          <ResultSectionTitle>검색 결과가 없습니다.</ResultSectionTitle>
          <ResultSectionDescription>
            검색어나 필터 조건을 바꿔 다시 시도하세요.
          </ResultSectionDescription>
        </ResultSectionHeader>
        <ResultSectionActions>
          <Button variant="outline">필터 초기화</Button>
        </ResultSectionActions>
      </ResultSection>
      <div className="grid content-start gap-2">
        <ContentPlaceholder aria-label="불러오지 못한 증빙 이미지" />
        <p className="text-caption text-text-subtle">
          미디어 로드 실패는 빈 공간 대신 명시적인 대체 상태를 표시합니다.
        </p>
      </div>
    </div>
  ),
}

export const SnackbarInteraction: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={() =>
          snackbar.success("변경 사항을 저장했습니다.", {
            description: "운영 정책 v3.4",
          })
        }
      >
        성공 메시지
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          snackbar("요청 3건을 보류했습니다.", {
            action: { label: "실행 취소", onClick: () => undefined },
          })
        }
      >
        실행 취소 메시지
      </Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole("button", { name: "성공 메시지" }))
    await waitFor(() => {
      const messages = body.getAllByText("변경 사항을 저장했습니다.")
      return expect(
        messages.some((message) =>
          message.closest("[data-sonner-toast][data-visible='true']"),
        ),
      ).toBe(true)
    })
  },
}
