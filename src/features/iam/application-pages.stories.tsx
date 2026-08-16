import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { BackofficeProvider } from "@/application/state/provider"
import { SessionAccessProvider } from "@/auth/session-access-provider"
import {
  ApplicationDetailPage,
  ApplicationsPage,
} from "@/features/iam/application-pages"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"

const application = localFixture.applications[0]
if (!application) throw new Error("Application fixture is missing")

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
  title: "Backoffice/IAM/Applications",
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
    await expect(canvas.getByText(application.slug)).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "어플리케이션 수정" }),
    ).toBeVisible()
  },
}
