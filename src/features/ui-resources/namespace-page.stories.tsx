import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { NamespacesPage } from "@/features/ui-resources/namespace-page"
import { NamespaceEditorPage } from "@/features/ui-resources/namespace-editor-page"
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
          <NamespacesPage />
        </div>
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
} satisfies Meta

export default meta
type Story = StoryObj

export const CreateNamespace: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={localDefaultUserId}
      >
        <div className="p-6">
          <NamespaceEditorPage />
        </div>
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(
      canvas.getByRole("textbox", { name: "네임스페이스 key" }),
      "customer-console",
    )
    await userEvent.type(
      canvas.getByRole("textbox", { name: "이름" }),
      "Customer Console",
    )
    await userEvent.type(
      canvas.getByRole("textbox", { name: "설명" }),
      "고객 시스템의 UI 리소스를 격리합니다.",
    )
    await userEvent.click(canvas.getByRole("combobox", { name: "관리 역할" }))
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      await body.findByRole("option", { name: "Backoffice 시스템 관리자" }),
    )
    await userEvent.click(canvas.getByRole("button", { name: "다음" }))
    await expect(
      canvas.getByRole("heading", { name: "입력 내용을 검토하세요" }),
    ).toBeVisible()
    await expect(canvas.getByText("customer-console")).toBeVisible()
    await expect(canvas.getByText("Backoffice 시스템 관리자")).toBeVisible()
    await expect(canvas.getByRole("button", { name: "등록" })).toBeEnabled()
  },
}
