import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import {
  OrganizationDetailPage,
  UserDetailPage,
  UsersPage,
} from "@/features/iam/directory-pages"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { BackofficeProvider } from "@/application/state/provider"

function findUserId(nickname: string) {
  const user = localFixture.users.find((item) => item.nickname === nickname)
  if (!user) throw new Error(`Fixture user not found: ${nickname}`)
  return user.id
}

const davidId = findUserId("David")
const emmaId = findUserId("Emma")
const owenId = findUserId("Owen")
const danielId = findUserId("Daniel")
const oliviaId = findUserId("Olivia")
const privacyOrganizationId = localFixture.organizations.find(
  (organization) => organization.name === "개인정보보호팀",
)?.id
if (!privacyOrganizationId) {
  throw new Error("Privacy organization fixture is missing")
}
const storyBackoffice = localFixture

function UserDetailStory({
  sessionUserId,
  targetUserId,
}: {
  sessionUserId: string
  targetUserId: string
}) {
  return (
    <BackofficeProvider initialState={storyBackoffice}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={sessionUserId}
      >
        <UserDetailPage userId={targetUserId} />
      </SessionAccessProvider>
    </BackofficeProvider>
  )
}

const meta = {
  title: "Access Governance/User management/User details",
  parameters: { layout: "fullscreen" },
} satisfies Meta

export default meta
type Story = StoryObj

export const AdministratorAssignments: Story = {
  render: () => (
    <UserDetailStory sessionUserId={localDefaultUserId} targetUserId={emmaId} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("button", { name: "조직 추가" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "역할 추가" }),
    ).toBeVisible()
  },
}

export const IamOperatorAssignments: Story = {
  render: () => (
    <UserDetailStory sessionUserId={owenId} targetUserId={davidId} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("link", { name: "개발 1팀" })).toBeVisible()
    await expect(
      canvas.getByRole("link", { name: "Access Governance 시스템 관리자" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "조직 추가" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "역할 추가" }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("heading", { name: "자격증명 이력" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("heading", { name: "요청 이력" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("heading", { name: "결재 템플릿 참여" }),
    ).not.toBeInTheDocument()
  },
}

export const IamOperatorList: Story = {
  render: () => (
    <BackofficeProvider initialState={storyBackoffice}>
      <SessionAccessProvider localSwitchingEnabled initialUserId={owenId}>
        <UsersPage />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 1, name: "사용자 관리" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("row", { name: "David 상세 보기" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("row", { name: "Olivia 상세 보기" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "사용자 등록" }),
    ).toBeVisible()
  },
}

export const GeneralUserCannotOpenResignedUser: Story = {
  render: () => (
    <UserDetailStory sessionUserId={danielId} targetUserId={oliviaId} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText("현재 세션에서 사용자를 찾을 수 없습니다."),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("heading", { level: 1, name: "Olivia" }),
    ).not.toBeInTheDocument()
  },
}

export const AdministratorCanOpenResignedUser: Story = {
  render: () => (
    <UserDetailStory
      sessionUserId={localDefaultUserId}
      targetUserId={oliviaId}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Olivia" }),
    ).toBeVisible()
    await expect(canvas.getAllByText("퇴직").length).toBeGreaterThan(0)
  },
}

export const IamOperatorOrganizationManagement: Story = {
  render: () => (
    <BackofficeProvider initialState={storyBackoffice}>
      <SessionAccessProvider localSwitchingEnabled initialUserId={owenId}>
        <OrganizationDetailPage organizationId={privacyOrganizationId} />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 1, name: "개인정보보호팀" }),
    ).toBeVisible()
    await expect(canvas.getByRole("link", { name: "James" })).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "조직 수정" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "사용자 추가" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "역할 추가" }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("heading", { name: "조직 관계 변경 영향" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("heading", { name: "포함된 결재 템플릿" }),
    ).not.toBeInTheDocument()
  },
}
