import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { HomeDashboard } from "@/features/home/home-dashboard"
import { BackofficeProvider } from "@/application/state/provider"

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

    await expect(
      canvas.getByRole("heading", { level: 1, name: "업무 홈" }),
    ).toBeVisible()
    await expect(canvas.getByText(/David님/)).toBeVisible()
    await expect(
      canvas.getByRole("heading", { name: "보유 정책" }),
    ).toBeVisible()
    const policyTable = canvas.getByRole("table", {
      name: "세션 사용자 보유 정책 목록",
    })
    await expect(
      within(policyTable).getByText("운영 모니터링 허용"),
    ).toBeVisible()
    await expect(
      within(policyTable).getByText("사용자 직접 부여"),
    ).toBeVisible()
    await expect(within(policyTable).getByText("조직 · 개발 1팀")).toBeVisible()
    await expect(
      canvas.queryByText("승인 대기 요청", { exact: true }),
    ).not.toBeInTheDocument()
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
    <BackofficeProvider initialState={localFixture}>
      <HomeDashboard />
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText("업무 홈")).toBeVisible()
    await expect(canvas.queryByText("활성 자격증명")).not.toBeInTheDocument()
    await expect(canvas.queryByText("재직 사용자")).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("heading", { name: "보유 정책" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("button", { name: "접근 정책 부여 요청 작성" }),
    ).not.toBeInTheDocument()
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
    await expect(canvas.getByText(/Emma님/)).toBeVisible()
    await expect(
      canvas.getByRole("heading", { name: "요청 및 소속 조직 자격증명" }),
    ).toBeVisible()
    const credentialTable = canvas.getByRole("table", {
      name: "세션 사용자 관련 자격증명 목록",
    })
    await expect(
      within(credentialTable).getByText("local-integration-key"),
    ).toBeVisible()
    await expect(
      within(credentialTable).getByText("어플리케이션 소유 조직"),
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
    const credentialTable = canvas.getByRole("table", {
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
      within(credentialTable).getByText("어플리케이션 소유 조직"),
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
    const permissionTable = canvas.getByRole("table", {
      name: "세션 사용자 보유 정책 목록",
    })

    await expect(canvas.getByText(/Charlotte님/)).toBeVisible()
    await expect(
      canvas.getByRole("heading", {
        name: "보유 정책",
      }),
    ).toBeVisible()
    await expect(
      within(permissionTable).getByText("운영 모니터링 허용"),
    ).toBeVisible()
    await expect(
      within(permissionTable).getByText("사용자 직접 부여"),
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
      canvas.getByRole("heading", { name: "보유 정책" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("table", { name: "세션 사용자 보유 정책 목록" }),
    ).toBeVisible()
  },
}
