import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import {
  ContrastIcon,
  KeyboardIcon,
  LanguagesIcon,
  MousePointer2Icon,
} from "lucide-react"

const meta = {
  title: "Foundation/Accessibility",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta

export default meta
type Story = StoryObj

const rules = [
  {
    icon: ContrastIcon,
    title: "Contrast",
    description: "본문 4.5:1, UI 경계와 focus indicator 3:1 이상을 유지합니다.",
  },
  {
    icon: KeyboardIcon,
    title: "Keyboard",
    description: "Tab 순서, 방향키 탐색, Escape 종료, focus 복귀를 확인합니다.",
  },
  {
    icon: MousePointer2Icon,
    title: "Target",
    description:
      "포인터 대상은 최소 24px, 반복 업무의 기본 컨트롤은 32px입니다.",
  },
  {
    icon: LanguagesIcon,
    title: "Language",
    description:
      "문서 언어와 컨트롤 이름을 명시하고 한·영 긴 문구를 점검합니다.",
  },
] as const

export const InclusiveDesign: Story = {
  name: "Accessibility",
  render: () => (
    <main className="mx-auto grid w-full max-w-content-default gap-10 px-layout-gutter py-8">
      <header className="grid max-w-3xl gap-2">
        <h1 className="text-title font-semibold tracking-tight">
          Accessibility
        </h1>
        <p className="text-body leading-6 text-text-subtle">
          접근성은 별도 모드가 아니라 모든 토큰, 컴포넌트, 문구가 통과해야 하는
          기본 품질 기준입니다.
        </p>
      </header>

      <section
        aria-label="Accessibility rules"
        className="grid gap-3 sm:grid-cols-2"
      >
        {rules.map(({ icon: Icon, title, description }) => (
          <article key={title} className="rounded-card border bg-surface p-4">
            <div className="flex items-center gap-2">
              <Icon className="size-4" aria-hidden="true" />
              <h2 className="font-medium">{title}</h2>
            </div>
            <p className="mt-2 text-body leading-5 text-text-subtle">
              {description}
            </p>
          </article>
        ))}
      </section>

      <section aria-labelledby="release-title" className="grid gap-3">
        <h2 id="release-title" className="text-heading font-semibold">
          Release checklist
        </h2>
        <ol className="grid list-decimal gap-2 rounded-card border bg-surface py-4 pr-4 pl-9 text-body leading-5">
          <li>이름·역할·상태가 보조 기술에 전달되는지 확인합니다.</li>
          <li>200% 확대와 320px viewport에서 콘텐츠 손실이 없는지 봅니다.</li>
          <li>색상 없이도 성공·주의·오류를 구분할 수 있게 씁니다.</li>
          <li>
            reduced motion에서 업무 완료에 필요한 정보가 사라지지 않게 합니다.
          </li>
        </ol>
      </section>
    </main>
  ),
}
