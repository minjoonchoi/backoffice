import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { CheckCircle2Icon, LoaderCircleIcon, XCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const meta = {
  title: "Foundation/Guidelines",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta

export default meta
type Story = StoryObj

const stateRows = [
  ["default", "작업 가능한 기본 상태", "이름과 역할이 명확해야 합니다."],
  ["hover", "포인터가 올라온 상태", "색 변화는 의미를 바꾸지 않습니다."],
  ["active", "누르는 동안의 상태", "짧고 즉각적인 피드백을 제공합니다."],
  ["focus-visible", "키보드 포커스 상태", "2px 고대비 ring을 유지합니다."],
  [
    "disabled",
    "사용할 수 없는 상태",
    "disabled 속성과 시각 표현을 함께 사용합니다.",
  ],
  [
    "read-only",
    "값을 볼 수만 있는 상태",
    "disabled와 구분하고 포커스를 허용합니다.",
  ],
  ["invalid", "검증에 실패한 상태", "aria-invalid와 오류 문구를 연결합니다."],
] as const

export const UsageGuidelines: Story = {
  name: "Guidelines",
  render: () => (
    <main className="mx-auto grid w-full max-w-6xl gap-10 p-6 sm:p-10">
      <header className="grid max-w-3xl gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Usage guidelines
        </h1>
        <p className="leading-7 text-muted-foreground">
          운영 화면의 속도를 해치지 않으면서 상태, 포커스, 오류를 누구나 같은
          방식으로 이해하도록 만드는 규칙입니다.
        </p>
      </header>

      <section aria-labelledby="accessibility-title" className="grid gap-4">
        <h2 id="accessibility-title" className="text-xl font-semibold">
          Accessibility
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>대비와 상태</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid list-disc gap-2 pl-5 leading-6">
                <li>
                  일반 텍스트는 4.5:1, UI 경계와 focus indicator는 3:1 이상
                </li>
                <li>성공·주의·오류를 색상만으로 전달하지 않기</li>
                <li>오류 문구에 role=alert 또는 연결된 설명 제공</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>키보드와 문구</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid list-disc gap-2 pl-5 leading-6">
                <li>논리적인 Tab 순서와 항상 보이는 focus-visible ring</li>
                <li>아이콘 전용 버튼에 접근 가능한 이름 제공</li>
                <li>한·영 긴 문구가 잘리지 않도록 유연한 폭과 줄바꿈 사용</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="states-title" className="grid gap-4">
        <h2 id="states-title" className="text-xl font-semibold">
          State specification
        </h2>
        <div className="overflow-x-auto rounded-lg border bg-surface">
          <table className="w-full min-w-160 text-left text-sm">
            <thead className="bg-surface-subtle">
              <tr>
                <th className="h-10 px-3 font-medium">State</th>
                <th className="h-10 px-3 font-medium">Meaning</th>
                <th className="h-10 px-3 font-medium">Rule</th>
              </tr>
            </thead>
            <tbody>
              {stateRows.map(([state, meaning, rule]) => (
                <tr key={state} className="border-t">
                  <th className="h-10 px-3 font-mono text-xs font-medium">
                    {state}
                  </th>
                  <td className="h-10 px-3">{meaning}</td>
                  <td className="h-10 px-3 text-muted-foreground">{rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="loading-title" className="grid gap-4">
        <div>
          <h2 id="loading-title" className="text-xl font-semibold">
            Loading pattern
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            별도 Button API를 추가하지 않고 disabled, aria-busy, spinner를
            조합합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-surface p-4">
          <Button disabled aria-busy="true">
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
            저장 중
          </Button>
          <code className="text-xs text-muted-foreground">
            disabled aria-busy=&quot;true&quot;
          </code>
        </div>
      </section>

      <section aria-labelledby="validation-title" className="grid gap-4">
        <h2 id="validation-title" className="text-xl font-semibold">
          Validation
        </h2>
        <div className="grid max-w-md gap-1.5">
          <Label htmlFor="guideline-email">이메일</Label>
          <Input
            id="guideline-email"
            type="email"
            defaultValue="invalid-address"
            aria-invalid="true"
            aria-describedby="guideline-email-error"
          />
          <p
            id="guideline-email-error"
            role="alert"
            className="text-sm text-destructive-foreground"
          >
            올바른 이메일 주소를 입력하세요.
          </p>
        </div>
      </section>

      <section aria-labelledby="examples-title" className="grid gap-4">
        <h2 id="examples-title" className="text-xl font-semibold">
          Do / Don&apos;t
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="border-success-foreground/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-success-foreground">
                <CheckCircle2Icon className="size-5" aria-hidden="true" /> Do
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid list-disc gap-2 pl-5 leading-6">
                <li>동작을 구체적으로 쓰기: “선택한 3건 승인”</li>
                <li>Label과 설명을 입력 컨트롤에 연결하기</li>
                <li>파괴적 동작은 확인 단계와 결과를 제공하기</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="border-destructive-foreground/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive-foreground">
                <XCircleIcon className="size-5" aria-hidden="true" /> Don&apos;t
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid list-disc gap-2 pl-5 leading-6">
                <li>“확인”처럼 결과를 알 수 없는 문구 사용</li>
                <li>placeholder를 Label 대신 사용</li>
                <li>오류를 빨간색 테두리 하나로만 표현</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  ),
}
