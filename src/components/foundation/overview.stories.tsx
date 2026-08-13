import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import {
  AccessibilityIcon,
  KeyboardIcon,
  LanguagesIcon,
  Rows3Icon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const meta = {
  title: "Foundation/Overview",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta

export default meta
type Story = StoryObj

const principles = [
  {
    icon: Rows3Icon,
    title: "정보 밀도",
    description:
      "32px 기본 컨트롤과 컴팩트 간격으로 반복 업무를 빠르게 훑고 처리합니다.",
  },
  {
    icon: AccessibilityIcon,
    title: "명확한 상태",
    description:
      "상태는 색상 하나에만 의존하지 않고 텍스트, 아이콘, ARIA 속성을 함께 사용합니다.",
  },
  {
    icon: KeyboardIcon,
    title: "키보드 우선",
    description:
      "모든 작업은 키보드로 완료할 수 있고 focus-visible 표시가 일관되게 유지됩니다.",
  },
  {
    icon: LanguagesIcon,
    title: "한·영 안정성",
    description:
      "고정 폭보다 유연한 레이아웃을 사용해 한국어와 긴 영문 문구를 모두 수용합니다.",
  },
] as const

export const SystemOverview: Story = {
  name: "Overview",
  render: () => (
    <main className="mx-auto grid w-full max-w-6xl gap-8 p-6 sm:p-10">
      <header className="grid max-w-3xl gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge>Backoffice</Badge>
          <Badge variant="secondary">Blue point</Badge>
          <Badge variant="outline">v1 foundation</Badge>
        </div>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight">
          빠르고 일관된 운영 업무를 위한 기반
        </h1>
        <p className="text-base leading-7 text-muted-foreground">
          내부 운영자와 구현 개발자가 함께 사용하는 중립형 디자인 시스템입니다.
          실제 업무 화면보다 재사용 가능한 토큰, 컴포넌트, 접근성 규칙을 먼저
          정의합니다.
        </p>
      </header>

      <section aria-labelledby="principles-title" className="grid gap-4">
        <h2 id="principles-title" className="text-xl font-semibold">
          Design principles
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {principles.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardHeader>
                <Icon className="size-5" aria-hidden="true" />
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-6 text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="scope-title" className="grid gap-4">
        <h2 id="scope-title" className="text-xl font-semibold">
          Scope
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>포함</CardTitle>
              <CardDescription>foundation이 보장하는 범위</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid list-disc gap-2 pl-5 leading-6">
                <li>CSS 변수 기반 primitive → semantic → component 토큰</li>
                <li>Base UI 기반 source-owned 컴포넌트</li>
                <li>WCAG AA 대비와 키보드 상호작용</li>
                <li>Storybook 사용 지침과 조합 예시</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>제외</CardTitle>
              <CardDescription>
                별도 요구와 자산 확정 후 다룰 범위
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid list-disc gap-2 pl-5 leading-6">
                <li>브랜드 로고와 마케팅 전용 표현</li>
                <li>다크 모드와 사용자 테마 전환</li>
                <li>업무별 DataTable과 범용 Form builder</li>
                <li>애플리케이션 홈 또는 업무 라우트 예시</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Baseline</CardTitle>
          <CardDescription>
            새 컴포넌트와 화면이 따라야 할 기본 규격
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground">
              Control
            </div>
            <div className="mt-1 text-lg font-semibold">32px</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">
              Typeface
            </div>
            <div className="mt-1 text-lg font-semibold">Noto Sans KR</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">
              Theme
            </div>
            <div className="mt-1 text-lg font-semibold">Light neutral</div>
          </div>
        </CardContent>
      </Card>
    </main>
  ),
}
