import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { GroupDetailPage, GroupsPage } from "@/features/iam/group-pages"
import { organizationLeaderGroup } from "@/mocks/system-fixture"
import { BackofficeProvider } from "@/application/state/provider"

const meta = {
  title: "Backoffice/Group management",
  parameters: { layout: "fullscreen" },
} satisfies Meta

export default meta
type Story = StoryObj

function findUserId(nickname: string) {
  const user = localFixture.users.find((item) => item.nickname === nickname)
  if (!user) throw new Error(`Fixture user not found: ${nickname}`)
  return user.id
}

export const AdministratorList: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={localDefaultUserId}
      >
        <GroupsPage />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 1, name: "그룹 관리" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("row", { name: "조직장 그룹 상세 보기" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "그룹 생성" }),
    ).toBeVisible()
  },
}

export const IamOperatorList: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={findUserId("Owen")}
      >
        <GroupsPage />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 1, name: "그룹 관리" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "그룹 생성" }),
    ).toBeVisible()
  },
}

export const SystemLeaderGroup: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={localDefaultUserId}
      >
        <GroupDetailPage groupId={organizationLeaderGroup.id} />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText(
        "조직 정보가 최신화될 때 조직장을 기준으로 자동 동기화됩니다.",
      ),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("button", { name: "사용자 추가" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.getAllByRole("button", { name: /연결 제거/ }),
    ).toHaveLength(localFixture.organizations.length)
    for (const button of canvas.getAllByRole("button", { name: /연결 제거/ })) {
      await expect(button).toBeDisabled()
    }
  },
}
