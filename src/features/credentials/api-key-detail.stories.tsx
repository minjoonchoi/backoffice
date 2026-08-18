import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { ApiKeyDetailPage } from "@/features/credentials/api-key-page"
import { CredentialLifecycleRequestPage } from "@/features/credentials/credential-lifecycle-request-page"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { BackofficeProvider } from "@/application/state/provider"
import type { BackofficeState } from "@/application/state/model"

const apiKey = localFixture.apiKeys[0]
if (!apiKey) throw new Error("Credential fixture is missing")
const apiKeyApprovalDocumentId = apiKey.approvalDocumentId
const replacementTemplate = localFixture.approvalLines.find(
  (template) => template.type === "api-key-replace",
)
if (!replacementTemplate) {
  throw new Error("Credential replacement template is missing")
}

const meta = {
  title: "Access Governance/Credential detail",
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

function createGrooLifecycleState(): {
  state: BackofficeState
  userId: string
} {
  const state = structuredClone(localFixture)
  const user = state.users.find((candidate) => candidate.nickname === "Jhonny")
  const organization = state.organizations.find(
    (candidate) => candidate.name === "개발실",
  )
  const issuance = state.approvalDocuments.find(
    (document) => document.id === apiKeyApprovalDocumentId,
  )
  if (!user || !organization || !issuance) {
    throw new Error("Groo lifecycle story fixture is incomplete")
  }
  issuance.requesterId = user.id
  issuance.organizationId = organization.id
  return { state, userId: user.id }
}

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
    await expect(
      canvas.getByRole("button", { name: "교체 요청" }),
    ).toHaveAttribute("href", `/credentials/${apiKey.id}/replace`)
    await expect(
      canvas.getByRole("button", { name: "폐기 요청" }),
    ).toHaveAttribute("href", `/credentials/${apiKey.id}/dispose`)
  },
}

export const GrooLifecycleDelegation: Story = {
  args: { apiKeyId: apiKey.id },
  render: () => {
    const { state, userId } = createGrooLifecycleState()
    return (
      <BackofficeProvider initialState={state}>
        <SessionAccessProvider localSwitchingEnabled initialUserId={userId}>
          <CredentialLifecycleRequestPage
            apiKey={apiKey}
            template={replacementTemplate}
            type="api-key-replace"
          />
        </SessionAccessProvider>
      </BackofficeProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(
      canvas.getByRole("textbox", { name: "교체 사유" }),
      "상위 조직장 확인을 위한 교체 요청입니다.",
    )
    await userEvent.click(canvas.getByRole("button", { name: "다음" }))
    await expect(
      canvas.getByRole("heading", { name: "Groo에서 결재를 진행합니다" }),
    ).toBeVisible()
    await expect(
      canvas.getByText(/제출 후 Groo 기안 요청 ID가 생성되며/),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "요청 제출" }),
    ).toBeEnabled()
  },
}
