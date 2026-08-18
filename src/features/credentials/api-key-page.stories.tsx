import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { backofficeErrorCodes } from "@/domain/common"
import { approvalDocumentKinds } from "@/features/access-policies/model"
import { CredentialIssuancePage } from "@/features/credentials/credential-issuance-page"
import { ApiKeyPage } from "@/features/credentials/api-key-page"
import { credentialRegistrationAttemptStatuses } from "@/features/credentials/model"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import type { BackofficeState } from "@/application/state/model"
import { BackofficeProvider } from "@/application/state/provider"

const meta = {
  title: "Backoffice/API key issuance",
  component: ApiKeyPage,
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
} satisfies Meta<typeof ApiKeyPage>

export default meta
type Story = StoryObj<typeof meta>

function findUserId(nickname: string) {
  const user = localFixture.users.find((item) => item.nickname === nickname)
  if (!user) throw new Error(`Fixture user not found: ${nickname}`)
  return user.id
}

function createRegistrationState(): BackofficeState {
  const state = structuredClone(localFixture)
  const sourceDocument = state.approvalDocuments.find(
    (document) => document.documentKind === "api-key-issuance",
  )
  const internalService = state.services.find(
    (service) => service.type === "internal",
  )
  const externalService = state.services.find(
    (service) => service.type === "external",
  )
  if (
    sourceDocument?.approvalExecution.type !== "groo" ||
    !internalService ||
    !externalService
  ) {
    throw new Error("Credential registration story fixture is incomplete")
  }
  state.approvalDocuments.push(
    {
      ...sourceDocument,
      id: "50000000-0000-4000-8000-000000000091",
      approvalExecution: {
        ...sourceDocument.approvalExecution,
        requestId: "GROO-REQUEST-STORY-INTERNAL",
      },
      title: "내부 서비스 등록 확인 요청",
      serviceId: internalService.id,
      endpointIds: state.serviceEndpoints
        .filter((endpoint) => endpoint.serviceId === internalService.id)
        .map((endpoint) => endpoint.id),
      keyName: "internal-registration-key",
      awsSecretName: "backoffice/internal-registration",
      awsSecretKey: "api-key",
    },
    {
      ...sourceDocument,
      id: "50000000-0000-4000-8000-000000000092",
      approvalExecution: {
        ...sourceDocument.approvalExecution,
        requestId: "GROO-REQUEST-STORY-EXTERNAL",
      },
      title: "외부 서비스 등록 확인 요청",
      serviceId: externalService.id,
      endpointIds: [],
      keyName: "external-registration-key",
      awsSecretName: "backoffice/external-registration",
      awsSecretKey: "api-key",
    },
  )
  return state
}

function createFailedRegistrationState(): BackofficeState {
  const state = createRegistrationState()
  const document = state.approvalDocuments.find(
    (candidate) => candidate.id === "50000000-0000-4000-8000-000000000091",
  )
  if (document?.documentKind !== approvalDocumentKinds.apiKeyIssuance) {
    throw new Error("Failed registration story document is missing")
  }
  state.credentialRegistrationAttempts.push({
    id: "82000000-0000-4000-8000-000000000091",
    approvalDocumentId: document.id,
    serviceId: document.serviceId,
    registeredByUserId: localDefaultUserId,
    apiKeyId: null,
    attemptNumber: 1,
    status: credentialRegistrationAttemptStatuses.failed,
    errorCode: backofficeErrorCodes.internalCredentialRegistrationFailed,
    createdAt: "2026-08-18T01:00:00.000Z",
  })
  return state
}

export const SeparateFromPermissionRequests: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole("heading", {
        level: 1,
        name: "자격증명",
      }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "자격증명 요청" }),
    ).toBeVisible()
    await expect(
      canvas.queryByText("API Key 발급 요청 템플릿"),
    ).not.toBeInTheDocument()
    await expect(
      canvas.getByRole("heading", { name: "자격 증명 요청 내역" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("heading", { name: "발급된 자격증명" }),
    ).toBeVisible()
    await expect(canvas.getAllByText("local-integration-key").length).toBe(2)
    await expect(
      canvas.queryByRole("columnheader", { name: "키 식별값" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("columnheader", { name: "등록 방식" }),
    ).not.toBeInTheDocument()
    await expect(canvas.queryAllByRole("switch")).toHaveLength(0)
    await expect(
      canvas.queryByText("보안성검토팀 권한 부여 요청"),
    ).not.toBeInTheDocument()
  },
}

export const UnrelatedGeneralUserScope: Story = {
  render: () => (
    <SessionAccessProvider
      localSwitchingEnabled
      initialUserId={findUserId("Daniel")}
    >
      <ApiKeyPage />
    </SessionAccessProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.queryByText("local-integration-key"),
    ).not.toBeInTheDocument()
    await expect(
      canvas.getByText("조회 가능한 자격 증명 요청이 없습니다."),
    ).toBeVisible()
    await expect(
      canvas.getByText("조회 가능한 자격증명이 없습니다."),
    ).toBeVisible()
  },
}

export const OwnedCredentialServiceIsExcluded: Story = {
  render: () => (
    <SessionAccessProvider
      localSwitchingEnabled
      initialUserId={findUserId("Amelia")}
    >
      <CredentialIssuancePage templates={localFixture.approvalLines} />
    </SessionAccessProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("radio", { name: /Developer Console/ }),
    )
    await expect(
      canvas.queryByRole("radio", { name: /Developer API/ }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.getByRole("radio", { name: /협업 SaaS/ }),
    ).toBeInTheDocument()
  },
}

export const ApplicationAndOrganizationArePrefilled: Story = {
  render: () => {
    const application = localFixture.applications.find(
      (candidate) => candidate.name === "Developer Console",
    )
    if (!application) throw new Error("Application fixture is missing")
    return (
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={findUserId("Emma")}
      >
        <CredentialIssuancePage
          templates={localFixture.approvalLines}
          initialApplicationId={application.id}
        />
      </SessionAccessProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("radio", { name: /Developer Console/ }),
    ).toBeChecked()
    await userEvent.click(canvas.getByRole("radio", { name: /협업 SaaS/ }))
    await expect(
      canvas.getByRole("combobox", { name: "요청 조직" }),
    ).toHaveTextContent("개발 2팀")
  },
}

export const RegistrationByServiceType: Story = {
  render: () => (
    <BackofficeProvider initialState={createRegistrationState()}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={localDefaultUserId}
      >
        <ApiKeyPage />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const screen = within(canvasElement.ownerDocument.body)
    const internalRow = canvas
      .getAllByRole("row")
      .find((row) => row.textContent.includes("internal-registration-key"))
    if (!internalRow) throw new Error("INTERNAL registration row not found")
    await userEvent.click(
      within(internalRow).getByRole("button", { name: "자격증명 등록" }),
    )
    let dialog = screen.getByRole("dialog", {
      name: "내부 서비스 자격증명 자동 등록",
    })
    await waitFor(async () => {
      await expect(dialog).toBeVisible()
    })
    await expect(
      within(dialog).queryByLabelText("API Key 원문"),
    ).not.toBeInTheDocument()
    await expect(
      within(dialog).getByText("backoffice/internal-registration"),
    ).toBeVisible()
    await userEvent.keyboard("{Escape}")
    await waitFor(async () => {
      await expect(dialog).not.toBeVisible()
    })

    const externalRow = canvas
      .getAllByRole("row")
      .find((row) => row.textContent.includes("external-registration-key"))
    if (!externalRow) throw new Error("EXTERNAL registration row not found")
    await userEvent.click(
      within(externalRow).getByRole("button", { name: "자격증명 등록" }),
    )
    dialog = screen.getByRole("dialog", {
      name: "외부 서비스 자격증명 수동 등록",
    })
    await waitFor(async () => {
      await expect(dialog).toBeVisible()
    })
    await expect(within(dialog).getByLabelText("API Key 원문")).toBeVisible()
    await expect(
      within(dialog).getByText("backoffice/external-registration"),
    ).toBeVisible()
  },
}

export const FailedRegistrationHasHistoryAndExplicitRetry: Story = {
  render: () => (
    <BackofficeProvider initialState={createFailedRegistrationState()}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={localDefaultUserId}
      >
        <ApiKeyPage />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const screen = within(canvasElement.ownerDocument.body)
    const failedRow = canvas
      .getAllByRole("row")
      .find((row) => row.textContent.includes("internal-registration-key"))
    if (!failedRow) throw new Error("Failed registration row not found")

    await expect(within(failedRow).getByText("등록 실패")).toBeVisible()
    await expect(
      within(failedRow).getByRole("button", { name: "등록 재시도" }),
    ).toBeVisible()
    await userEvent.click(
      within(failedRow).getByRole("button", { name: "1회" }),
    )
    const historyDialog = await screen.findByRole("dialog", {
      name: "등록 시도 이력",
    })
    await waitFor(async () => {
      await expect(within(historyDialog).getByText("1차")).toBeVisible()
      await expect(
        within(historyDialog).getByText(
          "자격증명 등록 API 처리에 실패했습니다. 다시 시도해 주세요.",
        ),
      ).toBeVisible()
    })
  },
}
