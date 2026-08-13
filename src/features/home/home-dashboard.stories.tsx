import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { HomeDashboard } from "@/features/home/home-dashboard"
import type { BackofficeState } from "@/application/state/model"
import { BackofficeProvider } from "@/application/state/provider"

function createDashboardState(): BackofficeState {
  const state = structuredClone(localFixture)
  const approvalDocument = state.approvalDocuments.find(
    (document) => document.documentKind === "general",
  )
  if (!approvalDocument) {
    throw new Error("Dashboard story requires a permission request")
  }
  approvalDocument.status = "submitted"
  return state
}

function findUserId(nickname: string) {
  const user = localFixture.users.find((item) => item.nickname === nickname)
  if (!user) throw new Error(`Dashboard story user not found: ${nickname}`)
  return user.id
}

const meta = {
  title: "Backoffice/Home dashboard",
  component: HomeDashboard,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof HomeDashboard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <BackofficeProvider initialState={createDashboardState()}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={localDefaultUserId}
      >
        <HomeDashboard />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const screen = within(canvasElement.ownerDocument.body)

    await expect(
      canvas.getByRole("heading", { level: 1, name: "업무 홈" }),
    ).toBeVisible()
    await expect(canvas.getByText(/David님/)).toBeVisible()
    await expect(
      canvas.getByRole("heading", { name: "내 업무 현황" }),
    ).toBeVisible()
    await userEvent.click(
      canvas.getByRole("button", { name: "보유 접근 권한 0개 보기" }),
    )
    const permissionDialog = await screen.findByRole("dialog", {
      name: "요청으로 부여된 접근 권한",
    })
    await waitFor(async () => {
      await expect(permissionDialog).toBeVisible()
    })
    const permissionTable = within(permissionDialog).getByRole("table", {
      name: "세션 사용자 보유 접근 권한 목록",
    })
    await expect(permissionTable).toBeVisible()
    await expect(
      within(permissionDialog).getByText(
        "요청을 통해 부여된 접근 권한이 없습니다.",
      ),
    ).toBeVisible()
    await userEvent.keyboard("{Escape}")
    await waitFor(async () => {
      await expect(permissionDialog).not.toBeVisible()
    })
    await userEvent.click(
      canvas.getByRole("button", { name: /승인 대기 요청 \d+개 보기/ }),
    )
    const requestDialog = screen.getByRole("dialog", {
      name: "대기 중인 요청",
    })
    await waitFor(async () => {
      await expect(requestDialog).toBeVisible()
    })
    await expect(
      within(requestDialog).getByRole("table", { name: "승인 대기 요청 목록" }),
    ).toBeVisible()
    await expect(
      within(requestDialog).getByText("보안 서비스 접근 요청"),
    ).toBeVisible()
    await expect(
      within(requestDialog).queryByText("로컬 API Key 발급 요청"),
    ).not.toBeInTheDocument()
    await userEvent.keyboard("{Escape}")
    await waitFor(async () => {
      await expect(requestDialog).not.toBeVisible()
    })
    await userEvent.click(canvas.getByRole("button", { name: "내 업무 정보" }))
    const workDialog = screen.getByRole("dialog", { name: "내 업무 정보" })
    await waitFor(async () => {
      await expect(workDialog).toBeVisible()
    })
    await expect(within(workDialog).getByText("개발 1팀")).toBeVisible()
    await userEvent.keyboard("{Escape}")
    await waitFor(async () => {
      await expect(workDialog).not.toBeVisible()
    })
    await expect(
      canvas.queryByRole("button", { name: "접근 정책 부여 요청 작성" }),
    ).not.toBeInTheDocument()
  },
}

export const DefaultMenuAccessWithoutLocalSession: Story = {
  render: () => (
    <BackofficeProvider initialState={createDashboardState()}>
      <HomeDashboard />
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText("업무 홈")).toBeVisible()
    await expect(canvas.queryByText("활성 자격증명")).not.toBeInTheDocument()
    await expect(canvas.queryByText("재직 사용자")).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("button", { name: /승인 대기 요청 \d+개 보기/ }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("heading", { name: "요청으로 부여된 접근 권한" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("button", { name: "접근 정책 부여 요청 작성" }),
    ).not.toBeInTheDocument()
  },
}

export const EmptyApprovalQueue: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={localDefaultUserId}
      >
        <HomeDashboard />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const screen = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      canvas.getByRole("button", { name: "승인 대기 요청 0개 보기" }),
    )
    const requestDialog = screen.getByRole("dialog", {
      name: "대기 중인 요청",
    })
    await waitFor(async () => {
      await expect(requestDialog).toBeVisible()
    })
    await expect(
      within(requestDialog).getByText("승인을 기다리는 요청이 없습니다."),
    ).toBeVisible()
  },
}

export const OrganizationLeader: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={findUserId("Emma")}
      >
        <HomeDashboard />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const screen = within(canvasElement.ownerDocument.body)

    await expect(canvas.getByText(/Emma님/)).toBeVisible()
    await expect(canvas.getByText("관련 자격증명")).toBeVisible()
    await userEvent.click(
      canvas.getByRole("button", { name: /관련 자격증명 \d+개 보기/ }),
    )
    const credentialDialog = screen.getByRole("dialog", {
      name: "요청 및 소속 조직 자격증명",
    })
    await waitFor(async () => {
      await expect(credentialDialog).toBeVisible()
    })
    const credentialTable = within(credentialDialog).getByRole("table", {
      name: "세션 사용자 관련 자격증명 목록",
    })
    await expect(
      within(credentialTable).getByText("local-integration-key"),
    ).toBeVisible()
    await expect(
      within(credentialTable).getByText("소속 조직 관리"),
    ).toBeVisible()
    await userEvent.keyboard("{Escape}")
    await waitFor(async () => {
      await expect(credentialDialog).not.toBeVisible()
    })
    await expect(
      canvas.getByRole("button", { name: /승인 대기 요청 \d+개 보기/ }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("button", { name: "접근 정책 부여 요청 작성" }),
    ).not.toBeInTheDocument()
  },
}

export const CredentialRequester: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={findUserId("Amelia")}
      >
        <HomeDashboard />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      canvas.getByRole("button", { name: /관련 자격증명 \d+개 보기/ }),
    )
    const credentialDialog = screen.getByRole("dialog", {
      name: "요청 및 소속 조직 자격증명",
    })
    await waitFor(async () => {
      await expect(credentialDialog).toBeVisible()
    })
    const credentialTable = within(credentialDialog).getByRole("table", {
      name: "세션 사용자 관련 자격증명 목록",
    })

    await expect(canvas.getByText(/Amelia님/)).toBeVisible()
    await expect(
      within(credentialTable).getByText("local-integration-key"),
    ).toBeVisible()
    await expect(
      within(credentialTable).getByText("내 발급 요청"),
    ).toBeVisible()
    await expect(
      within(credentialTable).getByText("소속 조직 관리"),
    ).toBeVisible()
  },
}

export const AccessRecipient: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={findUserId("Charlotte")}
      >
        <HomeDashboard />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      canvas.getByRole("button", { name: /보유 접근 권한 \d+개 보기/ }),
    )
    const permissionDialog = screen.getByRole("dialog", {
      name: "요청으로 부여된 접근 권한",
    })
    await waitFor(async () => {
      await expect(permissionDialog).toBeVisible()
    })
    const permissionTable = within(permissionDialog).getByRole("table", {
      name: "세션 사용자 보유 접근 권한 목록",
    })

    await expect(canvas.getByText(/Charlotte님/)).toBeVisible()
    await expect(
      within(permissionDialog).getByRole("heading", {
        name: "요청으로 부여된 접근 권한",
      }),
    ).toBeVisible()
    await expect(
      within(permissionTable).getByText("운영 모니터링 허용"),
    ).toBeVisible()
    await expect(
      within(permissionTable).getByRole("link", { name: "Developer API" }),
    ).toBeVisible()
    await expect(
      within(permissionTable).getByRole("link", { name: "Audit API" }),
    ).toBeVisible()
    await expect(within(permissionTable).getByText("허용")).toBeVisible()
    await expect(
      within(permissionTable).getByText("보안 서비스 접근 요청"),
    ).toBeVisible()
  },
}

export const InactiveUser: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={findUserId("Noah")}
      >
        <HomeDashboard />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole("heading", { level: 1, name: "업무 홈" }),
    ).toBeVisible()
    await expect(canvas.getByText(/Noah님/)).toBeVisible()
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole("button", { name: "내 업무 정보" }))
    const workDialog = screen.getByRole("dialog", { name: "내 업무 정보" })
    await waitFor(async () => {
      await expect(workDialog).toBeVisible()
    })
    await expect(within(workDialog).getByText("개발 1팀")).toBeVisible()
    await userEvent.keyboard("{Escape}")
    await waitFor(async () => {
      await expect(workDialog).not.toBeVisible()
    })
    await expect(
      canvas.getByRole("heading", { name: "내 업무 현황" }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("table", {
        name: "세션 사용자 보유 접근 권한 목록",
      }),
    ).not.toBeInTheDocument()
  },
}
