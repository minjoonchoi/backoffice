import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { AccessPolicyEditorPage } from "@/features/access-policies/access-policy-editor-page"
import { AccessPolicyDetailPage } from "@/features/access-policies/access-policy-detail-page"
import { ApprovalDocumentDetailPage } from "@/features/access-policies/approval-document-detail-page"
import { ApprovalReviewPage } from "@/features/access-policies/approval-review-page"
import type { ApprovalDocument } from "@/features/access-policies/model"
import type { BackofficeState } from "@/application/state/model"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { BackofficeProvider } from "@/application/state/provider"

const meta = {
  title: "Access Governance/Policy catalog",
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
    await expect(
      canvas.queryByRole("button", { name: "충돌 분석" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("button", { name: "권한 시뮬레이션" }),
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
    const policyTable = canvas.getByRole("table", { name: "권한 정책 목록" })
    await expect(
      within(policyRow).getByText("허용", { selector: '[data-slot="badge"]' }),
    ).toBeVisible()
    await expect(
      within(policyTable).queryByRole("columnheader", { name: "포함 리소스" }),
    ).not.toBeInTheDocument()
    await expect(
      within(policyTable).queryByRole("columnheader", { name: "상태" }),
    ).not.toBeInTheDocument()
    await expect(
      within(policyRow).queryByText("Developer API"),
    ).not.toBeInTheDocument()
    const administratorPolicyRow = canvas.getByRole("row", {
      name: /Access Governance 시스템 관리자 UI 접근/,
    })
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

export const AssignedPolicyAllowsAnotherTargetRequest: Story = {
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
    await expect(canvas.getByRole("button", { name: "요청하기" })).toBeVisible()
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
        <AccessPolicyEditorPage policyId={policy.id} />
      </SessionAccessProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const dialog = canvasElement
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
    await expect(
      within(dialog).getByText("설명 변경", {
        selector: '[data-slot="badge"]',
      }),
    ).toBeVisible()
    await expect(
      within(dialog).getByRole("heading", {
        name: "저장 후 알림",
      }),
    ).toBeVisible()
    const notificationSection = within(dialog).getByRole("region", {
      name: "저장 후 알림",
    })
    await expect(
      within(notificationSection).getByText(/변경 알림을 발송합니다/),
    ).toBeVisible()
    await expect(
      within(notificationSection).queryByText("운영 모니터링 허용"),
    ).not.toBeInTheDocument()
    await expect(
      within(dialog).queryByText("현재 부여 대상"),
    ).not.toBeInTheDocument()
    await expect(
      within(dialog).getByText(
        "다른 활성 정책까지 계산한 결과 실제 리소스 접근은 변경되지 않습니다.",
      ),
    ).toBeVisible()
    await expect(
      within(dialog).queryByRole("table", {
        name: "정책 변경에 따른 실제 리소스 접근 영향 목록",
      }),
    ).not.toBeInTheDocument()
  },
}

export const UpdatePolicyShowsActualResourceRisk: Story = {
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
        <AccessPolicyEditorPage policyId={policy.id} />
      </SessionAccessProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      canvas.getByRole("combobox", { name: "리소스 접근 효과" }),
    )
    await userEvent.click(await screen.findByRole("option", { name: "거부" }))
    await userEvent.click(
      canvas.getByRole("button", { name: "변경 영향 검토" }),
    )

    const impactTable = canvas.getByRole("table", {
      name: "정책 변경에 따른 실제 리소스 접근 영향 목록",
    })
    await expect(impactTable).toBeVisible()
    const healthResourceRow = within(impactTable).getByRole("row", {
      name: /GET \/health/,
    })
    await expect(within(healthResourceRow).getByText("접근 불가")).toBeVisible()
    await expect(
      within(healthResourceRow).queryByText(/실제 접근을 잃습니다/),
    ).not.toBeInTheDocument()
    await expect(canvas.queryByText("현재 부여 대상")).not.toBeInTheDocument()
    await expect(
      within(healthResourceRow).getByRole("button", {
        name: /영향 대상 사용자.*Charlotte/,
      }),
    ).toBeVisible()
  },
}

export const ProcessRequestFromDetail: Story = {
  render: () => {
    const source = localFixture.approvalDocuments.find(
      (document) =>
        document.documentKind === "general" && document.type === "access-grant",
    )
    if (!source) throw new Error("Access request fixture is missing")
    const submitted: ApprovalDocument = {
      ...source,
      status: "submitted",
      approvalSteps: source.approvalSteps.map((step) =>
        step.kind === "request"
          ? step
          : {
              ...step,
              status: "pending",
              processedById: null,
              processedAt: null,
              comment: null,
            },
      ),
      history: [source.history[0]].filter(
        (event): event is ApprovalDocument["history"][number] => Boolean(event),
      ),
    }
    const state: BackofficeState = {
      ...localFixture,
      approvalDocuments: localFixture.approvalDocuments.map((document) =>
        document.id === submitted.id ? submitted : document,
      ),
    }
    return (
      <BackofficeProvider initialState={state}>
        <SessionAccessProvider
          localSwitchingEnabled
          initialUserId={findUserId("Ethan")}
        >
          <ApprovalDocumentDetailPage requestId={submitted.id} />
        </SessionAccessProvider>
      </BackofficeProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("처리 필요")).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "승인" }))
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog", {
      name: "요청 단계를 처리할까요?",
    })
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "처리 의견" }),
      "요청 목적을 확인했습니다.",
    )
    await userEvent.click(
      within(dialog).getByRole("button", { name: "처리 완료" }),
    )
    await expect(await canvas.findByText("승인 완료")).toBeVisible()
    await expect(canvas.getByText("요청 목적을 확인했습니다.")).toBeVisible()
  },
}

export const CreatePolicy: Story = {
  render: () => (
    <SessionAccessProvider
      localSwitchingEnabled
      initialUserId={localDefaultUserId}
    >
      <AccessPolicyEditorPage />
    </SessionAccessProvider>
  ),
  play: async ({ canvasElement }) => {
    const dialog = canvasElement

    await expect(
      within(dialog).getByRole("textbox", { name: "정책 이름" }),
    ).toBeVisible()
    await expect(
      within(dialog).queryByRole("combobox", { name: "정책 유형" }),
    ).not.toBeInTheDocument()
    await expect(
      within(dialog).queryByRole("combobox", { name: "결재 템플릿" }),
    ).not.toBeInTheDocument()
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "정책 이름" }),
      "감사 이벤트 조회 허용",
    )
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "정책 설명" }),
      "감사 이벤트 조회에 필요한 엔드포인트를 허용합니다.",
    )
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
    await expect(
      within(dialog).getByRole("tab", { name: "엔드포인트" }),
    ).toBeVisible()
    await expect(
      within(dialog).getByRole("searchbox", {
        name: "서비스 선택",
      }),
    ).toBeVisible()
    await expect(
      within(dialog).queryByRole("searchbox", {
        name: "네임스페이스 검색",
      }),
    ).not.toBeInTheDocument()
    await userEvent.click(
      within(dialog).getByRole("radio", {
        name: /Audit API.*https:\/\/audit-api\.example\.com/,
      }),
    )
    await userEvent.click(
      within(dialog).getByRole("checkbox", {
        name: /GET.*\/v1\/audit-events.*감사 이벤트 조회 API/,
      }),
    )
    await userEvent.click(
      within(dialog).getByRole("radio", {
        name: /Developer API.*https:\/\/api\.example\.com/,
      }),
    )
    await userEvent.click(
      within(dialog).getByRole("checkbox", {
        name: /GET.*\/health.*상태 확인 API/,
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
        name: "상태 확인 API 선택 제거",
      }),
    )
    await expect(
      selectedResources.queryByText("Developer API"),
    ).not.toBeInTheDocument()
    const reviewStepButton = within(dialog)
      .getAllByRole("button", { name: "다음" })
      .at(-1)
    if (!reviewStepButton) throw new Error("Review step button is missing")
    await userEvent.click(reviewStepButton)
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
      within(dialog).queryByText("결재 템플릿", { exact: true }),
    ).not.toBeInTheDocument()
    await expect(
      within(dialog).queryByText("권한 부여 결재 템플릿"),
    ).not.toBeInTheDocument()
    const createButton = within(dialog).getByRole("button", { name: "등록" })
    await waitFor(async () => {
      await expect(createButton).toBeEnabled()
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
    await expect(
      canvas.queryByRole("button", { name: "충돌 분석" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("button", { name: "권한 시뮬레이션" }),
    ).not.toBeInTheDocument()
  },
}

export const PolicyOperatorCanReviewAndRevokeAssignments: Story = {
  render: () => (
    <SessionAccessProvider
      localSwitchingEnabled
      initialUserId={findUserId("Owen")}
    >
      <AccessPolicyDetailPage policyId="43000000-0000-4000-8000-000000000001" />
    </SessionAccessProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const table = canvas.getByRole("table", { name: "현재 부여 대상" })

    await expect(
      canvas.getByRole("heading", { name: "현재 부여 대상" }),
    ).toBeVisible()
    await expect(within(table).getByText("Charlotte")).toBeVisible()
    await expect(
      within(table).getByRole("button", {
        name: "Charlotte 연결 제거",
      }),
    ).toBeVisible()
  },
}

export const PaginatedUiResourcesPolicyDetail: Story = {
  render: () => (
    <AccessPolicyDetailPage policyId="45000000-0000-4000-8000-000000000101" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("tab", { name: /UI 리소스/ }))
    const table = canvas.getByRole("table", {
      name: "정책 포함 UI 리소스 목록",
    })
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

export const ClonePolicyPrefillsCreateEditor: Story = {
  render: () => {
    const policy = localFixture.accessPolicies.find(
      (candidate) => candidate.name === "운영 모니터링 허용",
    )
    if (!policy) throw new Error("Clone source policy fixture is missing")
    return (
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={localDefaultUserId}
      >
        <AccessPolicyEditorPage sourcePolicyId={policy.id} />
      </SessionAccessProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("textbox", { name: "정책 이름" }),
    ).toHaveValue("운영 모니터링 허용 복사본")
    await expect(
      canvas.getByRole("textbox", { name: "정책 설명" }),
    ).toHaveValue(
      "서비스 상태와 감사 이벤트를 함께 조회하는 운영 모니터링 리소스 접근을 허용합니다.",
    )
    const reviewButton = canvas
      .getAllByRole("button", { name: "다음" })
      .find((button) => button.getAttribute("type") === "submit")
    await expect(reviewButton).toBeVisible()
  },
}

export const RequestFromSelectedPolicyDetail: Story = {
  render: () => {
    const policy = localFixture.accessPolicies[0]
    if (!policy) throw new Error("Access policy detail story requires a policy")
    return (
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={findUserId("Daniel")}
      >
        <AccessPolicyDetailPage policyId={policy.id} />
      </SessionAccessProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const policyId = localFixture.accessPolicies[0]?.id
    if (!policyId)
      throw new Error("Access policy detail story requires a policy")
    await expect(canvas.getAllByText("포함 리소스")).toHaveLength(1)
    await expect(
      canvas.queryByText("https://api.example.com"),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByText("https://audit-api.example.com"),
    ).not.toBeInTheDocument()
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
    await expect(
      canvas.getByRole("button", { name: "요청하기" }),
    ).toHaveAttribute("href", `/approval-documents/${policyId}/request`)
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
