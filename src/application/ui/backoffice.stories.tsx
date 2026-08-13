import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { ApiKeyIssuanceDialog } from "@/features/credentials/api-key-issuance-dialog"
import { ApprovalDocumentDialog } from "@/features/access-policies/approval-document-dialog"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { BackofficeProvider } from "@/application/state/provider"

function findApprovalLine(type: "access-grant" | "api-key") {
  const line = localFixture.approvalLines.find((item) => item.type === type)
  if (!line) throw new Error(`Story approval line not found: ${type}`)
  return line
}

const accessPolicy = localFixture.accessPolicies[0]
if (!accessPolicy) throw new Error("Story access policy not found")
const accessApprovalLine = findApprovalLine("access-grant")
const apiKeyPolicy = findApprovalLine("api-key")

const meta = {
  title: "Patterns/Request dialogs",
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
} satisfies Meta

export default meta
type Story = StoryObj

export const PermissionPolicyRequest: Story = {
  render: () => (
    <ApprovalDocumentDialog
      policy={accessPolicy}
      approvalLine={accessApprovalLine}
      triggerLabel="접근 정책 요청"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("button", { name: "접근 정책 요청" }),
    )
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(async () => {
      await expect(body.getByRole("dialog")).toBeVisible()
    })
    await expect(
      body.queryByRole("combobox", { name: "요청 유형" }),
    ).not.toBeInTheDocument()
    const dialog = body.getByRole("dialog")
    await expect(
      within(dialog).queryByRole("searchbox"),
    ).not.toBeInTheDocument()
    await expect(
      within(dialog).getByRole("heading", {
        name: "요청 대상을 선택하세요",
      }),
    ).toBeVisible()
    await expect(
      within(dialog).getByText("운영 모니터링 허용", { exact: true }),
    ).toBeVisible()
    await userEvent.keyboard("{Escape}")
  },
}

export const ApiKeyCredentialRequest: Story = {
  render: () => <ApiKeyIssuanceDialog templates={[apiKeyPolicy]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "자격증명 요청" }))
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog")

    await waitFor(async () => {
      await expect(
        within(dialog).getByRole("searchbox", { name: "요청 대상 서비스" }),
      ).toBeVisible()
    })
    await userEvent.click(
      within(dialog).getByRole("radio", { name: /Developer API/ }),
    )
    await expect(
      within(dialog).queryByText("API Key 발급 요청 템플릿", {
        exact: true,
      }),
    ).not.toBeInTheDocument()
    await expect(
      within(dialog).queryByRole("combobox", { name: "요청 템플릿" }),
    ).not.toBeInTheDocument()
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: /GET \/health/ }),
    )
    await userEvent.click(within(dialog).getByRole("button", { name: "다음" }))
    await expect(
      within(dialog).getByRole("textbox", { name: "자격증명 이름" }),
    ).toBeVisible()
    await expect(
      within(dialog).getByRole("textbox", { name: "AWS ASM Secret name" }),
    ).toBeVisible()
    await expect(
      within(dialog).getByRole("textbox", { name: "Secret value key" }),
    ).toBeVisible()
    await expect(
      within(dialog).queryByRole("combobox", { name: "요청 유형" }),
    ).not.toBeInTheDocument()
    await expect(
      within(dialog).queryByRole("combobox", { name: "환경" }),
    ).not.toBeInTheDocument()
    await userEvent.keyboard("{Escape}")
  },
}
