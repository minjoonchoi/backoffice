import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { localFixture } from "@/mocks/fixture"
import { defaultIamOperatorRole } from "@/mocks/system-fixture"
import { RoleDetailPage, RolesPage } from "@/features/iam/role-pages"
import { BackofficeProvider } from "@/application/state/provider"

function findUserId(nickname: string) {
  const user = localFixture.users.find((item) => item.nickname === nickname)
  if (!user) throw new Error(`Fixture user not found: ${nickname}`)
  return user.id
}

function IamOperatorSession({ children }: { children: React.ReactNode }) {
  return (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={findUserId("Owen")}
      >
        {children}
      </SessionAccessProvider>
    </BackofficeProvider>
  )
}

const meta = {
  title: "Access Governance/Role management",
  parameters: { layout: "fullscreen" },
} satisfies Meta

export default meta
type Story = StoryObj

export const IamOperatorList: Story = {
  render: () => (
    <IamOperatorSession>
      <RolesPage />
    </IamOperatorSession>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 1, name: "역할 관리" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("row", {
        name: "Access Governance IAM 운영자 상세 보기",
      }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "역할 생성" }),
    ).toBeVisible()
    await expect(canvas.getByText("전체 역할")).toBeVisible()
    await expect(canvas.getByText("미사용 역할")).toBeVisible()
    await expect(canvas.queryByText("역할 부여 사용자")).not.toBeInTheDocument()
    await expect(canvas.queryByText("역할 부여 조직")).not.toBeInTheDocument()
  },
}

export const IamOperatorAssignments: Story = {
  render: () => (
    <IamOperatorSession>
      <RoleDetailPage roleId={defaultIamOperatorRole.id} />
    </IamOperatorSession>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", {
        level: 1,
        name: "Access Governance IAM 운영자",
      }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "사용자 추가" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "조직 추가" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("table", { name: "부여된 정책" }),
    ).toHaveTextContent("Access Governance IAM 운영자 UI 접근")
  },
}
