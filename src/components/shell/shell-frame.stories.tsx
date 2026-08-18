import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { ShellFrame } from "@/components/shell/shell-frame"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import { BackofficeProvider } from "@/application/state/provider"

const meta = {
  title: "Shell/AppShell",
  component: ShellFrame,
  parameters: { layout: "fullscreen" },
  args: {
    displayName: "Access Governance",
    labels: {
      skipToContent: "Skip to content",
      home: "Home",
      toggleSidebar: "Toggle sidebar",
      resizeSidebar: "Resize sidebar",
      language: "Language",
      localeLabels: { ko: "한국어", en: "English" },
      userMenu: "User menu",
      authStatus: "Authentication pending",
      permissionStatus: "No permissions",
      directory: "IAM",
      systemManagement: "System management",
      serviceCatalog: "Service catalog",
      uiCatalog: "UI catalog",
      users: "Users",
      organizations: "Organizations",
      roles: "Roles",
      applications: "Applications",
      namespaces: "Namespaces",
      requests: "Approvals",
      approvalLines: "Approval templates",
      approvalDocuments: "Policies",
      services: "Service catalog",
      serviceEndpoints: "Endpoints",
      apiKeys: "Credentials",
      uiResources: "UI Resources",
      auditLogs: "Audit",
      sessionAccess: "Local login user",
      localCurrentUser: "Current login user",
      localAuthStatus: "Local mock login",
      organizationCount: "Organizations",
      roleCount: "Effective roles",
      emptyMemberships: "None",
      accessibleMenuCount: "Accessible menus",
      accessDeniedTitle: "Access denied",
      accessDeniedDescription:
        "The current user's organizations and roles do not grant access to this menu.",
      goToAccessibleMenu: "Go to an accessible menu",
    },
    children: (
      <div className="rounded-xl border bg-card p-8">Shell content</div>
    ),
  },
} satisfies Meta<typeof ShellFrame>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("navigation", { name: "Home" })).toBeVisible()
    await expect(
      canvas.queryByRole("link", { name: "Service catalog" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.getByRole("heading", { name: "Access denied" }),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "User menu" }))
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(async () => {
      await expect(body.getByText("Authentication pending")).toBeVisible()
    })
    await userEvent.keyboard("{Escape}")
  },
}

export const LocalAccess: Story = {
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await expect(
      Array.from(
        canvas.getByRole("navigation", { name: "Home" }).querySelectorAll("p"),
        (heading) => heading.textContent,
      ),
    ).toEqual(["IAM", "Service catalog", "UI catalog", "System management"])
    await expect(canvas.getByRole("link", { name: "Policies" })).toBeVisible()
    await expect(canvas.getByRole("link", { name: "Approvals" })).toBeVisible()
    const organizationCount = canvas.getByRole("button", {
      name: "Organizations: 1",
    })
    await userEvent.hover(organizationCount)
    await expect(
      await body.findByRole("tooltip", { name: /Organizations 개발 1팀/ }),
    ).toHaveTextContent("개발 1팀")
    await userEvent.unhover(organizationCount)

    const roleCount = canvas.getByRole("button", {
      name: "Effective roles: 4",
    })
    await userEvent.hover(roleCount)
    await expect(
      await body.findByRole("tooltip", {
        name: /Effective roles Access Governance 시스템 관리자/,
      }),
    ).toHaveTextContent("Access Governance 시스템 관리자")
    await userEvent.unhover(roleCount)

    await userEvent.click(canvas.getByRole("button", { name: "User menu" }))
    await userEvent.click(await body.findByRole("menuitem", { name: "Amelia" }))

    await waitFor(async () => {
      await expect(canvas.getByText("Shell content")).toBeVisible()
      await expect(
        canvas.queryByRole("heading", { name: "Access denied" }),
      ).not.toBeInTheDocument()
      await expect(
        canvas.getByRole("link", { name: "Service catalog" }),
      ).toBeVisible()
      await expect(
        canvas.getByRole("link", { name: "Endpoints" }),
      ).toBeVisible()
      await expect(
        canvas.getByRole("link", { name: "Credentials" }),
      ).toBeVisible()
      await expect(canvas.getByRole("link", { name: "Policies" })).toBeVisible()
      await expect(canvas.getByRole("link", { name: "Users" })).toBeVisible()
      await expect(
        canvas.getByRole("link", { name: "Organizations" }),
      ).toBeVisible()
      await expect(
        canvas.getByRole("link", { name: "Namespaces" }),
      ).toBeVisible()
      await expect(
        canvas.queryByRole("link", { name: "Roles" }),
      ).not.toBeInTheDocument()
    })
  },
}

export const OrganizationLeaderAccess: Story = {
  decorators: [
    (Story) => {
      const operator = localFixture.users.find(
        (user) => user.nickname === "Emma",
      )
      if (!operator) throw new Error("Organization leader fixture is missing")

      return (
        <BackofficeProvider initialState={localFixture}>
          <SessionAccessProvider
            localSwitchingEnabled
            initialUserId={operator.id}
          >
            <Story />
          </SessionAccessProvider>
        </BackofficeProvider>
      )
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("link", { name: "Users" })).toBeVisible()
    await expect(
      canvas.getByRole("link", { name: "Organizations" }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("link", { name: "Roles" }),
    ).not.toBeInTheDocument()
    await expect(canvas.getByText("IAM", { exact: true })).toBeVisible()
    await expect(
      canvas.getByRole("link", { name: "Applications" }),
    ).toBeVisible()
    await expect(
      canvas.queryByText("System management"),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("link", { name: "Menus" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("link", { name: "Approval templates" }),
    ).not.toBeInTheDocument()
  },
}
