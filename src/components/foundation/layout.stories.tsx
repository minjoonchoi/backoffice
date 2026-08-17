import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Foundation/Layout",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta

export default meta
type Story = StoryObj

const densities = [
  {
    name: "Focused",
    token: "content-narrow · 720px",
    use: "설정, 단일 폼, 상세 검토",
    width: "max-w-content-narrow",
    grid: "grid-cols-6",
    columns: 6,
  },
  {
    name: "Standard",
    token: "content-default · 1120px",
    use: "기본 목록과 운영 대시보드",
    width: "max-w-content-default",
    grid: "grid-cols-9",
    columns: 9,
  },
  {
    name: "Wide",
    token: "content-wide · 1440px",
    use: "다열 데이터와 비교 작업",
    width: "max-w-content-wide",
    grid: "grid-cols-12",
    columns: 12,
  },
] as const

export const DashboardLayout: Story = {
  name: "Layout",
  render: () => (
    <main className="mx-auto grid w-full max-w-content-wide gap-10 px-layout-gutter py-8">
      <header className="grid max-w-3xl gap-2">
        <h1 className="text-title font-semibold tracking-tight">Layout</h1>
        <p className="text-body leading-6 text-text-subtle">
          화면 크기가 아니라 업무 복잡도에 맞춰 콘텐츠 폭을 고릅니다. gutter는
          12–24px 사이에서 유동적으로 변합니다.
        </p>
      </header>

      <section aria-labelledby="density-title" className="grid gap-4">
        <h2 id="density-title" className="text-heading font-semibold">
          Dashboard density
        </h2>
        <div className="grid gap-5">
          {densities.map(({ name, token, use, width, grid, columns }) => (
            <article key={name} className="grid gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium">{name}</h3>
                <code className="text-caption text-text-subtle">{token}</code>
              </div>
              <div
                className={`${width} ${grid} grid h-20 w-full gap-1 rounded-card border bg-surface p-3 shadow-raised`}
              >
                {Array.from({ length: columns }, (_, index) => (
                  <span
                    key={index}
                    className="rounded-sm bg-surface-selected"
                    aria-hidden="true"
                  />
                ))}
              </div>
              <p className="text-body text-text-subtle">{use}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="responsive-title" className="grid gap-4">
        <h2 id="responsive-title" className="text-heading font-semibold">
          Responsive rules
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            [
              "320px부터",
              "단일 열을 기본으로 하고 표는 가로 스크롤을 허용합니다.",
            ],
            [
              "고정 폭 금지",
              "버튼과 레이블은 번역문 길이에 따라 늘어나거나 줄바꿈합니다.",
            ],
            [
              "읽기 순서 유지",
              "시각적 재배치 뒤에도 DOM과 키보드 순서를 논리적으로 둡니다.",
            ],
          ].map(([title, description]) => (
            <article key={title} className="rounded-card border bg-surface p-4">
              <h3 className="font-medium">{title}</h3>
              <p className="mt-1 text-body leading-5 text-text-subtle">
                {description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  ),
}
