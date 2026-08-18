import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  InfoIcon,
  XCircleIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"

const meta = {
  title: "Components/Feedback & Display",
} satisfies Meta

export default meta
type Story = StoryObj

export const AlertVariants: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-3">
      <Alert>
        <AlertTitle>운영 안내</AlertTitle>
        <AlertDescription>
          정기 점검은 오늘 22:00에 시작합니다.
        </AlertDescription>
      </Alert>
      <Alert variant="info">
        <InfoIcon aria-hidden="true" />
        <AlertTitle>검토 기준이 변경되었습니다.</AlertTitle>
        <AlertDescription>
          새 기준은 다음 접수 건부터 적용됩니다.
        </AlertDescription>
      </Alert>
      <Alert variant="success">
        <CheckCircle2Icon aria-hidden="true" />
        <AlertTitle>일괄 승인이 끝났습니다.</AlertTitle>
        <AlertDescription>요청 24건을 승인했습니다.</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertTriangleIcon aria-hidden="true" />
        <AlertTitle>처리 기한이 임박했습니다.</AlertTitle>
        <AlertDescription>
          남은 요청 6건을 오늘 안에 검토하세요.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <XCircleIcon aria-hidden="true" />
        <AlertTitle>업로드를 완료하지 못했습니다.</AlertTitle>
        <AlertDescription>
          파일 형식을 확인하고 다시 시도하세요.
        </AlertDescription>
      </Alert>
    </div>
  ),
}

export const AvatarSizes: Story = {
  render: () => (
    <div className="flex items-center gap-3" aria-label="Operator avatars">
      <Avatar size="sm">
        <AvatarFallback>김</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>MJ</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>운영</AvatarFallback>
      </Avatar>
    </div>
  ),
}

export const ProgressStates: Story = {
  render: () => (
    <div className="grid max-w-lg gap-6">
      <Progress value={68}>
        <ProgressLabel>CSV 가져오기</ProgressLabel>
        <ProgressValue />
      </Progress>
      <Progress value={100} variant="success">
        <ProgressLabel>정산 데이터 검증</ProgressLabel>
        <ProgressValue />
      </Progress>
      <Progress value={null} variant="info" aria-label="보고서 생성 중" />
    </div>
  ),
}

export const Separators: Story = {
  render: () => (
    <div className="flex h-12 max-w-md items-center gap-4 rounded-card border bg-surface px-4 text-body">
      <span>요청 24건</span>
      <Separator orientation="vertical" />
      <span>승인 18건</span>
      <Separator orientation="vertical" />
      <span>보류 6건</span>
    </div>
  ),
}
