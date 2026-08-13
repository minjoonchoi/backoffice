import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { AccessPolicyDetailPage } from "@/features/access-policies/access-policy-detail-page"
import { ApprovalReviewPage } from "@/features/access-policies/approval-review-page"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { BackofficeProvider } from "@/application/state/provider"

const meta = {
  title: "Backoffice/Policy catalog",
  component: ApprovalReviewPage,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <BackofficeProvider initialState={localFixture}>
        <Story />
      </BackofficeProvider>
    ),
  ],
} satisfies Meta<typeof ApprovalReviewPage>

export default meta
type Story = StoryObj<typeof meta>

function findUserId(nickname: string) {
  const user = localFixture.users.find((item) => item.nickname === nickname)
  if (!user) throw new Error(`Fixture user not found: ${nickname}`)
  return user.id
}

export const PolicyListUsesOwnershipStatus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole("heading", { level: 1, name: "정책" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("heading", { level: 2, name: "권한 정책" }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("button", { name: "접근 정책 요청" }),
    ).not.toBeInTheDocument()
    await expect(canvas.getByText("운영 모니터링 허용")).toBeVisible()
    await expect(
      canvas.queryByRole("columnheader", { name: "기능 묶음" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("columnheader", { name: "적용 대상" }),
    ).not.toBeInTheDocument()

    const policyRow = canvas.getByRole("row", {
      name: /운영 모니터링 허용/,
    })
    await expect(
      within(policyRow).getByText("허용", { selector: '[data-slot="badge"]' }),
    ).toBeVisible()
    await expect(within(policyRow).getByText("2개")).toBeVisible()
    await expect(
      within(policyRow).queryByText("Developer API"),
    ).not.toBeInTheDocument()
    const administratorPolicy = localFixture.accessPolicies.find(
      (policy) => policy.name === "Backoffice 시스템 관리자 UI 접근",
    )
    if (!administratorPolicy) {
      throw new Error("Backoffice administrator UI policy fixture is missing")
    }
    const administratorPolicyRow = canvas.getByRole("row", {
      name: /Backoffice 시스템 관리자 UI 접근/,
    })
    await expect(
      within(administratorPolicyRow).getByText(
        `${String(administratorPolicy.resources.length)}개`,
      ),
    ).toBeVisible()
    await expect(
      within(administratorPolicyRow).queryByText("services:list:createService"),
    ).not.toBeInTheDocument()
    const denyPolicyRow = canvas.getByRole("row", {
      name: /Developer API 이벤트 발행 거부/,
    })
    await expect(
      within(denyPolicyRow).getByText("거부", {
        selector: '[data-slot="badge"]',
      }),
    ).toBeVisible()
    const [policySearch] = canvas.getAllByRole("searchbox", {
      name: "정책 이름",
    })
    if (!policySearch) throw new Error("Policy search input is missing")
    await userEvent.type(policySearch, "운영 모니터링")
    await expect(denyPolicyRow).not.toBeInTheDocument()
    await expect(
      within(policyRow).getByText("미보유", {
        selector: '[data-slot="badge"]',
      }),
    ).toBeVisible()
    await expect(
      within(policyRow).queryByRole("button", { name: "요청" }),
    ).not.toBeInTheDocument()
  },
}

export const AssignedPolicyHidesRequestActions: Story = {
  render: () => {
    const policy = localFixture.accessPolicies.find(
      (candidate) => candidate.name === "운영 모니터링 허용",
    )
    if (!policy) throw new Error("Assigned policy fixture is missing")
    return (
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={findUserId("Charlotte")}
      >
        <div className="grid gap-8">
          <ApprovalReviewPage />
          <AccessPolicyDetailPage policyId={policy.id} />
        </div>
      </SessionAccessProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const policyRow = canvas.getByRole("row", {
      name: /운영 모니터링 허용/,
    })
    await expect(
      within(policyRow).queryByRole("button", { name: "요청" }),
    ).not.toBeInTheDocument()
    await expect(
      within(policyRow).getByText("보유 중", {
        selector: '[data-slot="badge"]',
      }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("button", { name: "요청하기" }),
    ).not.toBeInTheDocument()
  },
}

export const UpdatePolicyReviewsImpact: Story = {
  render: () => {
    const policy = localFixture.accessPolicies.find(
      (candidate) => candidate.name === "운영 모니터링 허용",
    )
    if (!policy) throw new Error("Assigned policy fixture is missing")
    return (
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={findUserId("Owen")}
      >
        <AccessPolicyDetailPage policyId={policy.id} />
      </SessionAccessProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "정책 수정" }))
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog", { name: "정책 수정" })
    const description = within(dialog).getByRole("textbox", {
      name: "정책 설명",
    })
    await userEvent.clear(description)
    await userEvent.type(
      description,
      "영향 검토가 필요한 정책 설명 변경입니다.",
    )
    await userEvent.click(
      within(dialog).getByRole("button", { name: "변경 영향 검토" }),
    )

    await expect(
      within(dialog).getByRole("heading", {
        name: "정책 변경 영향을 확인하세요",
      }),
    ).toBeVisible()
    await expect(within(dialog).getByText("설명 변경")).toBeVisible()
    await expect(within(dialog).getByText("Charlotte")).toBeVisible()
    await expect(within(dialog).getByText("알림 대상 사용자")).toBeVisible()
  },
}

export const CreatePolicy: Story = {
  render: () => (
    <SessionAccessProvider
      localSwitchingEnabled
      initialUserId={localDefaultUserId}
    >
      <ApprovalReviewPage />
    </SessionAccessProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const [catalogSearch] = canvas.getAllByRole("searchbox", {
      name: "정책 이름",
    })
    if (!catalogSearch) throw new Error("Policy catalog search is missing")
    await userEvent.clear(catalogSearch)
    await userEvent.click(
      canvas.getByRole("button", { name: "신규 정책 생성" }),
    )
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog")
    await waitFor(async () => {
      await expect(dialog).toBeVisible()
    })

    await expect(
      within(dialog).getByRole("textbox", { name: "정책 이름" }),
    ).toBeVisible()
    await expect(
      within(dialog).queryByRole("combobox", { name: "정책 유형" }),
    ).not.toBeInTheDocument()
    await expect(
      within(dialog).queryByRole("combobox", { name: "요청 템플릿" }),
    ).not.toBeInTheDocument()
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "정책 이름" }),
      "감사 이벤트 조회 허용",
    )
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "정책 설명" }),
      "감사 이벤트 조회에 필요한 엔드포인트를 허용합니다.",
    )
    await userEvent.click(within(dialog).getByRole("button", { name: "다음" }))
    await expect(
      within(dialog).getByRole("radio", { name: /UI 기능 사용/ }),
    ).toBeVisible()
    await expect(
      within(dialog).getByRole("combobox", {
        name: "리소스 접근 효과",
      }),
    ).toBeVisible()
    await userEvent.click(
      within(dialog).getByRole("radio", { name: /API 직접 호출/ }),
    )
    await userEvent.click(within(dialog).getByRole("button", { name: "다음" }))
    await expect(
      within(dialog).getByRole("tab", { name: "엔드포인트" }),
    ).toBeVisible()
    await expect(
      within(dialog).getByRole("searchbox", {
        name: "서비스 또는 엔드포인트 검색",
      }),
    ).toBeVisible()
    await expect(
      within(dialog).queryByRole("searchbox", {
        name: "네임스페이스 검색",
      }),
    ).not.toBeInTheDocument()
    await userEvent.click(
      within(dialog).getByRole("checkbox", {
        name: /Audit API.*GET.*\/v1\/audit-events/,
      }),
    )
    await userEvent.click(
      within(dialog).getByRole("checkbox", {
        name: /Developer API.*GET.*\/health/,
      }),
    )
    const selectedResources = within(
      within(dialog).getByRole("complementary", { name: "선택한 리소스" }),
    )
    await expect(selectedResources.getByText("Audit API")).toBeVisible()
    await expect(selectedResources.getByText("Developer API")).toBeVisible()
    await expect(
      selectedResources.getByText("GET /v1/audit-events"),
    ).toBeVisible()
    await userEvent.click(
      selectedResources.getByRole("button", {
        name: "Developer API /health 선택 제거",
      }),
    )
    await expect(
      selectedResources.queryByText("Developer API"),
    ).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "다음" }))
    await expect(
      within(dialog).getByRole("heading", {
        name: "정책 구성을 검토하세요",
      }),
    ).toBeVisible()
    await expect(
      within(dialog).getByText("감사 이벤트 조회 허용"),
    ).toBeVisible()
    await expect(
      within(dialog).getByText(
        "감사 이벤트 조회에 필요한 엔드포인트를 허용합니다.",
      ),
    ).toBeVisible()
    await expect(
      within(dialog).queryByText("정책 유형", { exact: true }),
    ).not.toBeInTheDocument()
    await expect(
      within(dialog).queryByText("요청 템플릿", { exact: true }),
    ).not.toBeInTheDocument()
    await expect(
      within(dialog).queryByText("권한 부여 요청 템플릿"),
    ).not.toBeInTheDocument()
    const createButton = within(dialog).getByRole("button", { name: "등록" })
    await waitFor(async () => {
      await expect(createButton).toBeEnabled()
    })
    await userEvent.click(createButton)
    await waitFor(async () => {
      await expect(dialog).not.toBeVisible()
    })
    await waitFor(async () => {
      await expect(canvas.getByText("감사 이벤트 조회 허용")).toBeVisible()
    })
  },
}

export const GeneralUserSeesCompletePolicyCatalog: Story = {
  render: () => (
    <SessionAccessProvider
      localSwitchingEnabled
      initialUserId={findUserId("Daniel")}
    >
      <ApprovalReviewPage />
    </SessionAccessProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.queryByRole("button", { name: "신규 정책 생성" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.getByRole("table", { name: "접근 정책 부여 요청 목록" }),
    ).toBeVisible()
    await expect(canvas.getByText("운영 모니터링 허용")).toBeVisible()
    await expect(
      canvas.getByText("Developer API 이벤트 발행 거부"),
    ).toBeVisible()
  },
}

export const PolicyOperatorCanCreatePolicy: Story = {
  render: () => (
    <SessionAccessProvider
      localSwitchingEnabled
      initialUserId={findUserId("Owen")}
    >
      <ApprovalReviewPage />
    </SessionAccessProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("button", { name: "신규 정책 생성" }),
    ).toBeVisible()
  },
}

export const PaginatedUiResourcesPolicyDetail: Story = {
  render: () => (
    <AccessPolicyDetailPage policyId="45000000-0000-4000-8000-000000000101" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const table = canvas.getByRole("table", { name: "UI 리소스 목록" })
    const policy = localFixture.accessPolicies.find(
      (candidate) => candidate.id === "45000000-0000-4000-8000-000000000101",
    )
    if (!policy) throw new Error("Administrator UI policy is missing")
    const resourceCount = policy.resources.filter(
      (resource) => resource.type === "ui-resource",
    ).length
    const pageCount = Math.ceil(resourceCount / 20)

    await expect(within(table).getAllByRole("row")).toHaveLength(21)
    await expect(
      canvas.getByText(`1 / ${String(pageCount)} 페이지`),
    ).toBeVisible()

    await userEvent.click(canvas.getByRole("button", { name: "다음" }))

    await expect(
      canvas.getByText(`2 / ${String(pageCount)} 페이지`),
    ).toBeVisible()
    await expect(within(table).getAllByRole("row")).toHaveLength(
      Math.min(20, resourceCount - 20) + 1,
    )
  },
}

export const RequestFromSelectedPolicyDetail: Story = {
  render: () => {
    const policy = localFixture.accessPolicies[0]
    if (!policy) throw new Error("Access policy detail story requires a policy")
    return <AccessPolicyDetailPage policyId={policy.id} />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText("포함 리소스")).toHaveLength(1)
    await expect(canvas.getByText("https://api.example.com")).toBeVisible()
    await expect(
      canvas.getByText("https://audit-api.example.com"),
    ).toBeVisible()
    await expect(canvas.getByText("/health")).toBeVisible()
    await expect(canvas.getByText("/v1/audit-events")).toBeVisible()
    await expect(
      canvas.queryByText("https://api.example.com/health"),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByText("https://audit-api.example.com/v1/audit-events"),
    ).not.toBeInTheDocument()
    await expect(canvas.getByText("$.status")).toBeVisible()
    await expect(canvas.getByText("$.items")).toBeVisible()
    await expect(canvas.getAllByText("응답 본문")).toHaveLength(2)
    await userEvent.click(canvas.getByRole("button", { name: "요청하기" }))
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog")
    await waitFor(async () => {
      await expect(dialog).toBeVisible()
    })
    await expect(
      within(dialog).queryByRole("searchbox"),
    ).not.toBeInTheDocument()
    await expect(
      within(dialog).getByRole("heading", {
        name: "요청 대상을 선택하세요",
      }),
    ).toBeVisible()
    await expect(
      within(dialog).getByText("운영 모니터링 허용", { exact: true }),
    ).toBeVisible()
    await userEvent.click(
      within(dialog).getByRole("combobox", { name: "요청자" }),
    )
    await userEvent.click(await body.findByRole("option", { name: "David" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "다음" }))
    await expect(
      within(dialog).getByRole("heading", {
        name: "요청 사유와 처리 담당자를 입력하세요",
      }),
    ).toBeVisible()
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "요청 사유 및 내용" }),
      "운영 상태 확인을 위해 접근 권한이 필요합니다.",
    )
    await userEvent.click(within(dialog).getByRole("button", { name: "다음" }))
    await expect(
      within(dialog).getByRole("heading", { name: "요청 내용을 검토하세요" }),
    ).toBeVisible()
    await expect(within(dialog).getAllByText("David")[0]).toBeVisible()
    await expect(within(dialog).getAllByText("개발 1팀")[0]).toBeVisible()
    await userEvent.click(within(dialog).getByRole("button", { name: "이전" }))
    await expect(
      within(dialog).getByRole("heading", {
        name: "요청 사유와 처리 담당자를 입력하세요",
      }),
    ).toBeVisible()
    await userEvent.keyboard("{Escape}")
  },
}

export const RequestFieldsPolicyDetail: Story = {
  render: () => {
    const policy = localFixture.accessPolicies[1]
    if (!policy) throw new Error("Request field policy story requires a policy")
    return <AccessPolicyDetailPage policyId={policy.id} />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("/v1/events")).toBeVisible()
    await expect(canvas.getByText("헤더")).toBeVisible()
    await expect(canvas.getByText("쿼리")).toBeVisible()
    await expect(canvas.getAllByText("요청 본문")).toHaveLength(2)
    await expect(canvas.getByText("응답 본문")).toBeVisible()
    await expect(canvas.getByText("$['x-request-id']")).toBeVisible()
    await expect(canvas.getByText("$.eventType")).toBeVisible()
    await expect(canvas.getByText("$.payload")).toBeVisible()
    await expect(canvas.getByText("$.accepted")).toBeVisible()
  },
}
