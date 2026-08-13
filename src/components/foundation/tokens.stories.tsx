import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Foundation/Tokens",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta

export default meta
type Story = StoryObj

const colors = [
  {
    name: "background / foreground",
    className: "bg-background text-foreground border",
    usage: "페이지 배경과 기본 텍스트",
  },
  {
    name: "surface / foreground",
    className: "bg-surface text-foreground border",
    usage: "카드와 입력 표면",
  },
  {
    name: "surface-selected / text-strong",
    className: "bg-surface-selected text-text-strong border",
    usage: "선택된 행과 탐색 항목",
  },
  {
    name: "brand-solid / foreground",
    className: "bg-brand text-brand-foreground",
    usage: "파란 포인트와 주요 동작",
  },
  {
    name: "brand-weak / foreground",
    className: "bg-brand-weak text-brand-weak-foreground border-stroke-brand",
    usage: "선택·강조된 정보",
  },
  {
    name: "secondary / secondary-foreground",
    className: "bg-secondary text-secondary-foreground border",
    usage: "보조 동작",
  },
  {
    name: "info / info-foreground",
    className: "bg-info text-info-foreground",
    usage: "안내 상태",
  },
  {
    name: "info-solid / foreground",
    className: "bg-info-solid text-info-solid-foreground",
    usage: "강한 안내",
  },
  {
    name: "success / success-foreground",
    className: "bg-success text-success-foreground",
    usage: "완료 상태",
  },
  {
    name: "success-solid / foreground",
    className: "bg-success-solid text-success-solid-foreground",
    usage: "강한 완료 상태",
  },
  {
    name: "warning / warning-foreground",
    className: "bg-warning text-warning-foreground",
    usage: "주의 상태",
  },
  {
    name: "warning-solid / foreground",
    className: "bg-warning-solid text-warning-solid-foreground",
    usage: "강한 주의 상태",
  },
  {
    name: "destructive / destructive-foreground",
    className: "bg-destructive text-destructive-foreground",
    usage: "오류와 위험 상태",
  },
  {
    name: "destructive-solid / foreground",
    className: "bg-destructive-solid text-destructive-solid-foreground",
    usage: "강한 오류 상태",
  },
] as const

const spaces = [
  ["space-1", "w-1"],
  ["space-2", "w-2"],
  ["space-3", "w-3"],
  ["space-4", "w-4"],
  ["space-6", "w-6"],
  ["space-8", "w-8"],
  ["space-10", "w-10"],
  ["space-12", "w-12"],
  ["space-16", "w-16"],
] as const

const palettes = [
  {
    name: "Blue · brand / info",
    steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900],
    prefix: "blue",
  },
  {
    name: "Emerald · success",
    steps: [50, 100, 200, 700, 800, 900],
    prefix: "green",
  },
  {
    name: "Gold · warning",
    steps: [50, 100, 200, 400, 800, 900],
    prefix: "yellow",
  },
  {
    name: "Rose · destructive",
    steps: [50, 100, 200, 700, 800, 900],
    prefix: "red",
  },
] as const

const tokenLayers = [
  ["primitive", "neutral-900 · space-4 · duration-1", "실제 값의 제한된 집합"],
  [
    "semantic",
    "text-strong · layout-gutter · duration-fast",
    "사용 목적과 의미",
  ],
  [
    "component",
    "control-height · card-shadow · overlay-radius",
    "컴포넌트의 실제 차이",
  ],
] as const

export const TokenGallery: Story = {
  name: "Tokens",
  render: () => (
    <main className="mx-auto grid w-full max-w-6xl gap-10 p-6 sm:p-10">
      <header className="grid max-w-3xl gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Design tokens</h1>
        <p className="leading-7 text-muted-foreground">
          CSS 변수가 단일 원천입니다. primitive는 값을, semantic은 의미를,
          component 토큰은 control·card·overlay의 실제 차이를 표현합니다.
        </p>
      </header>

      <section aria-labelledby="layers-title" className="grid gap-4">
        <h2 id="layers-title" className="text-heading font-semibold">
          Token layers
        </h2>
        <div className="overflow-x-auto rounded-card border bg-surface">
          <table className="w-full min-w-160 text-left text-body">
            <thead className="bg-surface-subtle">
              <tr>
                <th className="h-10 px-3 font-medium">Layer</th>
                <th className="h-10 px-3 font-medium">Examples</th>
                <th className="h-10 px-3 font-medium">Responsibility</th>
              </tr>
            </thead>
            <tbody>
              {tokenLayers.map(([layer, examples, responsibility]) => (
                <tr key={layer} className="border-t border-border-subtle">
                  <th className="h-10 px-3 font-mono text-caption font-medium">
                    {layer}
                  </th>
                  <td className="h-10 px-3 font-mono text-caption text-text-subtle">
                    {examples}
                  </td>
                  <td className="h-10 px-3">{responsibility}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="color-title" className="grid gap-4">
        <div>
          <h2 id="color-title" className="text-heading font-semibold">
            Semantic colors
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            cool slate를 바탕으로 blue·emerald·gold·rose를 조합했습니다. 아래
            foreground 조합은 일반 텍스트 WCAG AA 대비를 목표로 합니다.
          </p>
        </div>
        <div className="grid gap-4 rounded-card border bg-surface p-4">
          {palettes.map((palette) => (
            <div key={palette.name} className="grid gap-1.5">
              <h3 className="text-caption font-medium text-text-subtle">
                {palette.name}
              </h3>
              <div className="flex overflow-hidden rounded-md border border-border-subtle">
                {palette.steps.map((step) => (
                  <span
                    key={step}
                    role="img"
                    aria-label={`${palette.name} ${String(step)}`}
                    className="h-10 min-w-5 flex-1"
                    style={{
                      backgroundColor: `var(--primitive-color-${palette.prefix}-${String(step)})`,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {colors.map((color) => (
            <div
              key={color.name}
              className={`${color.className} grid min-h-28 content-between rounded-lg p-4`}
            >
              <code className="text-xs font-semibold">{color.name}</code>
              <span className="text-sm">{color.usage}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="type-title" className="grid gap-4">
        <h2 id="type-title" className="text-heading font-semibold">
          Typography
        </h2>
        <div className="overflow-hidden rounded-lg border bg-surface">
          <div className="grid gap-1 border-b p-4">
            <code className="text-caption text-text-subtle">
              text-title / semibold
            </code>
            <span className="text-title font-semibold">
              운영 현황 Operations overview
            </span>
          </div>
          <div className="grid gap-1 border-b p-4">
            <code className="text-caption text-text-subtle">
              text-heading / semibold
            </code>
            <span className="text-heading font-semibold">
              섹션 제목 Section title
            </span>
          </div>
          <div className="grid gap-1 border-b p-4">
            <code className="text-caption text-text-subtle">
              text-body / regular
            </code>
            <span className="text-body">본문과 컨트롤 Body and controls</span>
          </div>
          <div className="grid gap-1 p-4">
            <code className="text-caption text-text-subtle">
              text-caption / medium
            </code>
            <span className="text-caption font-medium">
              보조 정보 Supporting metadata
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="space-title" className="grid gap-4">
        <h2 id="space-title" className="text-heading font-semibold">
          Spacing
        </h2>
        <div className="grid gap-3 rounded-lg border bg-surface p-4">
          {spaces.map(([name, width]) => (
            <div
              key={name}
              className="grid grid-cols-24 items-center gap-4 text-sm"
            >
              <code className="col-span-7 sm:col-span-4">{name}</code>
              <div
                className={`${width} col-span-17 h-4 bg-primary sm:col-span-20`}
              />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="shape-title" className="grid gap-4">
        <h2 id="shape-title" className="text-heading font-semibold">
          Radius, shadow, motion
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-control border bg-surface p-4">
            <code className="text-xs">radius-control</code>
            <p className="mt-6 text-sm text-muted-foreground">
              Inputs and buttons
            </p>
          </div>
          <div className="rounded-card border bg-card p-4 shadow-card">
            <code className="text-xs">radius-card / shadow-card</code>
            <p className="mt-6 text-sm text-muted-foreground">
              Contained sections
            </p>
          </div>
          <div className="rounded-overlay border bg-popover p-4 shadow-overlay">
            <code className="text-xs">radius-overlay / shadow-overlay</code>
            <p className="mt-6 text-sm text-muted-foreground">
              Popup and dialog
            </p>
          </div>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          색상 전환은 100ms, 구조 변화는 150ms, 큰 overlay 전환은 240ms 안에서
          끝냅니다. reduced motion 설정에서는 즉시 전환합니다.
        </p>
      </section>
    </main>
  ),
}
