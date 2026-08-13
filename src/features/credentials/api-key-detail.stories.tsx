import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { ApiKeyDetailPage } from "@/features/credentials/api-key-page"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { BackofficeProvider } from "@/application/state/provider"

const apiKey = localFixture.apiKeys[0]
if (!apiKey) throw new Error("Credential fixture is missing")

const meta = {
  title: "Backoffice/Credential detail",
  component: ApiKeyDetailPage,
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
} satisfies Meta<typeof ApiKeyDetailPage>

export default meta
type Story = StoryObj<typeof meta>

export const LifecycleRequestHistory: Story = {
  args: { apiKeyId: apiKey.id },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 1, name: apiKey.name }),
    ).toBeVisible()
    await expect(canvas.getByText("로컬 API Key 발급 요청")).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "교체 요청" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "폐기 요청" }),
    ).toBeVisible()

    await userEvent.click(canvas.getByRole("button", { name: "교체 요청" }))
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog")
    await waitFor(async () => {
      await expect(
        within(dialog).getByRole("heading", { name: "API Key 교체 요청" }),
      ).toBeVisible()
    })
    await expect(within(dialog).getByText(apiKey.name)).toBeVisible()
    await expect(within(dialog).getByText("Developer API")).toBeVisible()
    await userEvent.keyboard("{Escape}")
  },
}
