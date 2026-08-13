import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { UiNamespacesPage } from "@/features/ui-resources/ui-namespace-page"
import { BackofficeProvider } from "@/application/state/provider"

const meta = {
  title: "Backoffice/Namespace management",
  parameters: { layout: "fullscreen" },
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={localDefaultUserId}
      >
        <div className="p-6">
          <UiNamespacesPage />
        </div>
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
} satisfies Meta

export default meta
type Story = StoryObj

export const CreateNamespace: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "네임스페이스 추가" })
    await expect(trigger).toHaveAttribute(
      "data-ui-resource",
      "namespaces:list:createNamespace",
    )
    await userEvent.click(trigger)

    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog", {
      name: "네임스페이스 추가",
    })
    const modal = within(dialog)
    await userEvent.type(
      modal.getByRole("textbox", { name: "네임스페이스 key" }),
      "customer-console",
    )
    await userEvent.type(
      modal.getByRole("textbox", { name: "이름" }),
      "Customer Console",
    )
    await userEvent.type(
      modal.getByRole("textbox", { name: "설명" }),
      "고객 시스템의 UI 리소스를 격리합니다.",
    )
    await userEvent.click(
      modal.getByRole("combobox", { name: "시스템 관리자 역할" }),
    )
    await userEvent.click(
      await body.findByRole("option", { name: "Backoffice 시스템 관리자" }),
    )
    await userEvent.click(modal.getByRole("button", { name: "등록" }))
    await waitFor(() => expect(dialog).not.toBeVisible())
    const createdRow = canvas.getByRole("row", { name: /customer-console/ })
    await expect(
      within(createdRow).getByRole("cell", { name: "customer-console" }),
    ).toBeVisible()
    await expect(
      within(createdRow).getByRole("cell", {
        name: "Backoffice 시스템 관리자",
      }),
    ).toBeVisible()
  },
}
