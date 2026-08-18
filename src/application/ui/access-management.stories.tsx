import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { ApprovalLineDetailPage } from "@/features/request-templates/request-template-pages"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { BackofficeProvider } from "@/application/state/provider"

function findUserId(nickname: string) {
  const user = localFixture.users.find((item) => item.nickname === nickname)
  if (!user) throw new Error(`Fixture user not found: ${nickname}`)
  return user.id
}

const requestTemplate = localFixture.approvalLines[0]
if (!requestTemplate) throw new Error("Request template fixture is missing")

const meta = {
  title: "Access Governance/Access management details",
  parameters: { layout: "fullscreen" },
} satisfies Meta

export default meta
type Story = StoryObj

export const RequestTemplateConfiguration: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={localDefaultUserId}
      >
        <ApprovalLineDetailPage approvalLineId={requestTemplate.id} />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Groo 연동 기안")).toBeVisible()
    await expect(canvas.getByText("GROO-CREDENTIAL-ISSUANCE-V1")).toBeVisible()
    await expect(
      canvas.getByRole("heading", { name: "입력 항목 구성" }),
    ).toBeVisible()
    await expect(canvas.getByText("자격증명 이름")).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "결재 템플릿 수정" }),
    ).toBeVisible()
  },
}

export const RequestTemplateReadOnly: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={findUserId("Emma")}
      >
        <ApprovalLineDetailPage approvalLineId={requestTemplate.id} />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Groo 연동 기안")).toBeVisible()
    await expect(
      canvas.queryByRole("button", { name: "결재 템플릿 수정" }),
    ).not.toBeInTheDocument()
  },
}
