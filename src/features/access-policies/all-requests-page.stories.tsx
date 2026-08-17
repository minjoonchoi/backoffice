import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import { BackofficeProvider } from "@/application/state/provider"
import { SessionAccessProvider } from "@/auth/session-access-provider"
import { AllRequestsPage } from "@/features/access-policies/all-requests-page"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"

const meta = {
  title: "Backoffice/System requests",
  component: AllRequestsPage,
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
} satisfies Meta<typeof AllRequestsPage>

export default meta
type Story = StoryObj<typeof meta>

export const AllRequestTypes: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const screen = within(canvasElement.ownerDocument.body)

    await expect(
      canvas.getByRole("heading", { level: 1, name: "요청" }),
    ).toBeVisible()
    const table = canvas.getByRole("table", { name: "전체 요청 목록" })
    await expect(within(table).getByText("접근 정책")).toBeVisible()
    await expect(within(table).getAllByText("자격증명")).toHaveLength(2)
    await expect(
      within(table).getByText("로컬 API Key 발급 요청"),
    ).toBeVisible()
    await expect(within(table).getByText("보안 서비스 접근 요청")).toBeVisible()

    await userEvent.click(canvas.getByRole("combobox", { name: "검색" }))
    await userEvent.click(
      await screen.findByRole("option", { name: "요청 분류" }),
    )
    await userEvent.type(
      canvas.getByRole("searchbox", { name: "요청 분류" }),
      "자격증명",
    )

    await expect(
      within(table).getByText("로컬 API Key 발급 요청"),
    ).toBeVisible()
    await expect(
      within(table).queryByText("보안 서비스 접근 요청"),
    ).not.toBeInTheDocument()
  },
}
