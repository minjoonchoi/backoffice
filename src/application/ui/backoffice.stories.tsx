import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { CredentialIssuancePage } from "@/features/credentials/credential-issuance-page"
import { ApprovalDocumentRequestPage } from "@/features/access-policies/approval-document-request-page"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { BackofficeProvider } from "@/application/state/provider"

function findApprovalLine(type: "access-grant" | "api-key") {
  const line = localFixture.approvalLines.find((item) => item.type === type)
  if (!line) throw new Error(`Story approval line not found: ${type}`)
  return line
}

function findUserId(nickname: string) {
  const user = localFixture.users.find((item) => item.nickname === nickname)
  if (!user) throw new Error(`Story user not found: ${nickname}`)
  return user.id
}

const accessPolicy = localFixture.accessPolicies[0]
if (!accessPolicy) throw new Error("Story access policy not found")
const accessApprovalLine = findApprovalLine("access-grant")
const apiKeyPolicy = findApprovalLine("api-key")

const meta = {
  title: "Patterns/Request pages",
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
    <ApprovalDocumentRequestPage
      policy={accessPolicy}
      approvalLine={accessApprovalLine}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.queryByRole("combobox", { name: "요청 유형" }),
    ).not.toBeInTheDocument()
    await expect(canvas.queryByRole("searchbox")).not.toBeInTheDocument()
    await expect(
      canvas.getByRole("heading", {
        name: "요청 대상을 선택하세요",
      }),
    ).toBeVisible()
    await expect(
      canvas.getByText("운영 모니터링 허용", { exact: true }),
    ).toBeVisible()
  },
}

export const ApiKeyCredentialRequest: Story = {
  render: () => (
    <SessionAccessProvider
      localSwitchingEnabled
      initialUserId={findUserId("Amelia")}
    >
      <CredentialIssuancePage templates={[apiKeyPolicy]} />
    </SessionAccessProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(async () => {
      await expect(
        canvas.getByRole("searchbox", { name: "요청 대상 서비스" }),
      ).toBeVisible()
    })
    await userEvent.click(
      canvas.getByRole("radio", { name: /Developer Console/ }),
    )
    await userEvent.click(canvas.getByRole("radio", { name: /Audit API/ }))
    await expect(
      canvas.queryByText("API Key 발급 요청 템플릿", {
        exact: true,
      }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("combobox", { name: "요청 템플릿" }),
    ).not.toBeInTheDocument()
    await userEvent.click(
      canvas.getByRole("checkbox", { name: /GET \/v1\/audit-events/ }),
    )
    await expect(
      canvas.getByRole("textbox", { name: "자격증명 이름" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("textbox", { name: "AWS ASM Secret name" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("textbox", { name: "Secret value key" }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("combobox", { name: "요청 유형" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("combobox", { name: "환경" }),
    ).not.toBeInTheDocument()
    await userEvent.type(
      canvas.getByRole("textbox", { name: "자격증명 이름" }),
      "Developer API key",
    )
    await userEvent.type(
      canvas.getByRole("textbox", { name: "AWS ASM Secret name" }),
      "backoffice/developer-api",
    )
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Secret value key" }),
      "apiKey",
    )
    await userEvent.type(
      canvas.getByRole("textbox", { name: "발급 사유" }),
      "개발 환경 연동에 사용합니다.",
    )
    await userEvent.click(canvas.getByRole("button", { name: "다음" }))
    await expect(
      canvas.getByRole("heading", { name: "자격증명 요청 내용을 검토하세요" }),
    ).toBeVisible()
  },
}
