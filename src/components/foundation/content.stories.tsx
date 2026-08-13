import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { CheckCircle2Icon, XCircleIcon } from "lucide-react"
import { useLocale } from "next-intl"

const meta = {
  title: "Foundation/Content",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta

export default meta
type Story = StoryObj

function LocalizedActionExample() {
  const locale = useLocale()
  const label =
    locale === "ko"
      ? "선택한 요청 3건 승인"
      : "Approve the 3 selected access requests"

  return (
    <div className="flex max-w-sm flex-wrap items-center justify-between gap-3 rounded-card border bg-surface p-4">
      <span className="min-w-0 text-body text-text-subtle">
        {locale === "ko" ? "검토가 끝났나요?" : "Finished reviewing?"}
      </span>
      <button
        type="button"
        className="min-h-control rounded-control bg-primary px-3 text-body font-medium text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
      </button>
    </div>
  )
}

export const WritingAndInternationalization: Story = {
  name: "Content",
  render: () => (
    <main className="mx-auto grid w-full max-w-content-default gap-10 px-layout-gutter py-8">
      <header className="grid max-w-3xl gap-2">
        <h1 className="text-title font-semibold tracking-tight">Content</h1>
        <p className="text-body leading-6 text-text-subtle">
          운영 문구는 짧게 만드는 것보다 결과와 해결 방법을 정확히 알려주는 것이
          우선입니다.
        </p>
      </header>

      <section aria-labelledby="writing-title" className="grid gap-4">
        <h2 id="writing-title" className="text-heading font-semibold">
          Writing
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <article className="rounded-card border border-success-foreground/30 bg-success p-4 text-success-foreground">
            <h3 className="flex items-center gap-2 font-medium">
              <CheckCircle2Icon className="size-4" aria-hidden="true" /> Do
            </h3>
            <p className="mt-2 text-body leading-5">
              이메일 형식을 확인하고 다시 입력하세요.
            </p>
          </article>
          <article className="rounded-card border border-destructive-foreground/30 bg-destructive p-4 text-destructive-foreground">
            <h3 className="flex items-center gap-2 font-medium">
              <XCircleIcon className="size-4" aria-hidden="true" /> Don&apos;t
            </h3>
            <p className="mt-2 text-body leading-5">잘못된 값입니다.</p>
          </article>
        </div>
      </section>

      <section aria-labelledby="locale-title" className="grid gap-4">
        <div>
          <h2 id="locale-title" className="text-heading font-semibold">
            Internationalization
          </h2>
          <p className="mt-1 text-body text-text-subtle">
            Storybook toolbar의 locale을 바꿔 긴 영문에서도 줄바꿈과 동작 영역을
            확인합니다.
          </p>
        </div>
        <LocalizedActionExample />
      </section>

      <section aria-labelledby="format-title" className="grid gap-3">
        <h2 id="format-title" className="text-heading font-semibold">
          Locale-sensitive data
        </h2>
        <ul className="grid list-disc gap-2 pl-5 text-body leading-5 text-text-subtle">
          <li>날짜·시간·숫자·통화는 Intl API와 현재 locale로 표시합니다.</li>
          <li>
            문자열을 이어 붙이지 않고 번역 가능한 완전한 문장으로 관리합니다.
          </li>
          <li>
            이름, ID, 긴 조직명은 잘림 여부와 전체 확인 방법을 함께 설계합니다.
          </li>
        </ul>
      </section>
    </main>
  ),
}
