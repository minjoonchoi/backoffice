import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import { BackofficeProvider } from "@/application/state/provider"
import { SessionAccessProvider } from "@/auth/session-access-provider"
import {
  ApplicationDetailPage,
  ApplicationsPage,
} from "@/features/iam/application-pages"
import { ApplicationEditorPage } from "@/features/iam/application-editor-page"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"

const application = localFixture.applications[0]
if (!application) throw new Error("Application fixture is missing")
const generalUser = localFixture.users.find((user) => user.nickname === "Emma")
if (!generalUser) throw new Error("General user fixture is missing")

function AdministratorSession({ children }: { children: React.ReactNode }) {
  return (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={localDefaultUserId}
      >
        {children}
      </SessionAccessProvider>
    </BackofficeProvider>
  )
}

const meta = {
  title: "Access Governance/IAM/Applications",
  parameters: { layout: "fullscreen" },
} satisfies Meta

export default meta
type Story = StoryObj

export const List: Story = {
  render: () => (
    <AdministratorSession>
      <ApplicationsPage />
    </AdministratorSession>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 1, name: "어플리케이션" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "어플리케이션 등록" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("row", {
        name: new RegExp(`${application.name} 상세 보기`),
      }),
    ).toBeVisible()
  },
}

export const Detail: Story = {
  render: () => (
    <AdministratorSession>
      <ApplicationDetailPage applicationId={application.id} />
    </AdministratorSession>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 1, name: application.name }),
    ).toBeVisible()
    await expect(canvas.getByText(application.applicationKey)).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "어플리케이션 수정" }),
    ).toBeVisible()
  },
}

export const OrganizationScopedDetail: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={generalUser.id}
      >
        <ApplicationDetailPage applicationId={application.id} />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("button", { name: "자격증명 생성" }),
    ).toHaveAttribute(
      "href",
      `/credentials/request?applicationId=${application.id}`,
    )
    await expect(
      canvas.getByRole("button", { name: "어플리케이션 수정" }),
    ).toHaveAttribute("href", `/applications/${application.id}/edit`)
    await expect(canvas.getByRole("button", { name: "삭제" })).toBeDisabled()
    await expect(canvas.getByRole("button", { name: "삭제" })).toHaveAttribute(
      "title",
      "유효한 자격증명이 있어 삭제할 수 없습니다.",
    )
  },
}

export const OrganizationScopedList: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={generalUser.id}
      >
        <ApplicationsPage />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("button", { name: "어플리케이션 등록" }),
    ).toBeVisible()
    await expect(canvas.getByText("Developer Console")).toBeVisible()
    await expect(canvas.queryByText("Platform Automation")).toBeNull()
  },
}

export const OrganizationScopedCreate: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={generalUser.id}
      >
        <ApplicationEditorPage />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("combobox", { name: "소유 조직" }),
    ).toHaveTextContent("개발 2팀")
    await expect(canvas.queryByText("개발 1팀")).toBeNull()

    const applicationKeyInput = canvas.getByRole("textbox", {
      name: "어플리케이션 키",
    })
    await userEvent.type(applicationKeyInput, "한글ABC")
    await expect(applicationKeyInput).toHaveValue("")
    await expect(applicationKeyInput).toHaveAttribute("aria-invalid", "true")

    await userEvent.type(applicationKeyInput, "_console")
    await expect(applicationKeyInput).toHaveValue("_console")
    await expect(applicationKeyInput).toHaveAttribute("aria-invalid", "true")

    await userEvent.clear(applicationKeyInput)
    await userEvent.type(applicationKeyInput, "developer_console_01")
    await expect(applicationKeyInput).toHaveValue("developer_console_01")
    await expect(applicationKeyInput).toHaveAttribute("aria-invalid", "false")
  },
}
