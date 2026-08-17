import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { BackofficeProvider } from "@/application/state/provider"
import { ApprovalLineDetailPage } from "@/features/request-templates/request-template-pages"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"

const credentialTemplate = localFixture.approvalLines.find(
  (template) => template.type === "api-key",
)
if (!credentialTemplate) {
  throw new Error("Credential request template fixture is missing")
}

const meta = {
  title: "Backoffice/Request templates/Detail",
  component: ApprovalLineDetailPage,
  args: { approvalLineId: credentialTemplate.id },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <BackofficeProvider initialState={localFixture}>
        <SessionAccessProvider
          localSwitchingEnabled
          initialUserId={localDefaultUserId}
        >
          <Story />
        </SessionAccessProvider>
      </BackofficeProvider>
    ),
  ],
} satisfies Meta<typeof ApprovalLineDetailPage>

export default meta
type Story = StoryObj<typeof meta>

export const ShowsRequestProgress: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { name: "템플릿 사용 요청" }),
    ).toBeVisible()
    const requestRow = canvas.getByRole("row", {
      name: /로컬 API Key 발급 요청/,
    })
    await expect(within(requestRow).getByText("승인 완료")).toBeVisible()
    await expect(within(requestRow).getByText("Groo 처리")).toBeVisible()
    await expect(canvas.getByText("Groo 연동 기안")).toBeVisible()
    await expect(canvas.getByText("GROO-CREDENTIAL-ISSUANCE-V1")).toBeVisible()
  },
}
