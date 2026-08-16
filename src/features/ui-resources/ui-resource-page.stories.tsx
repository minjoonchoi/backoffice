import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { defaultBackofficeAdminRole } from "@/mocks/system-fixture"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import {
  UiResourceSyncPage,
  UiResourcesPage,
} from "@/features/ui-resources/ui-resource-page"
import { BackofficeProvider } from "@/application/state/provider"

const storyBackoffice = structuredClone(localFixture)
const storyNamespaceId = "99000000-0000-4000-8000-000000000001"
const storyManagerPolicyId = "99000000-0000-4000-8000-000000000002"
const backofficeNamespace = storyBackoffice.namespaces.find(
  (namespace) => namespace.key === "backoffice",
)
if (!backofficeNamespace) {
  throw new Error("Story Backoffice namespace fixture is missing")
}
backofficeNamespace.managerRoleId = defaultBackofficeAdminRole.id
const storyManagementResource = storyBackoffice.uiResources[0]
if (!storyManagementResource) {
  throw new Error("Story UI resource fixture is missing")
}
storyBackoffice.namespaces.push({
  id: storyNamespaceId,
  key: "story-console",
  name: "Story Console",
  description: "Storybook UI Resource 격리 검증용 namespace입니다.",
  managerRoleId: defaultBackofficeAdminRole.id,
  managerAccessPolicyId: storyManagerPolicyId,
  status: "active",
  lastSyncedAt: null,
  createdAt: "2026-08-11T00:00:00.000Z",
})
storyBackoffice.accessPolicies.push({
  id: storyManagerPolicyId,
  name: "Story Console 시스템 관리자 UI 리소스 허용",
  description: "Story Console 시스템 관리자 권한을 검증합니다.",
  type: "access-grant",
  managementType: "system-managed",
  effect: "allow",
  resources: [{ type: "ui-resource", id: storyManagementResource.id }],
  status: "active",
  createdAt: "2026-08-11T00:00:00.000Z",
})
storyBackoffice.accessPolicyAssignments.push({
  id: "99000000-0000-4000-8000-000000000003",
  accessPolicyId: storyManagerPolicyId,
  targetType: "role",
  targetId: defaultBackofficeAdminRole.id,
  expiresAt: null,
  createdAt: "2026-08-11T00:00:00.000Z",
})

const meta = {
  title: "Backoffice/UI Resource catalog",
  parameters: { layout: "fullscreen" },
  render: () => (
    <BackofficeProvider initialState={storyBackoffice}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={localDefaultUserId}
      >
        <div className="p-6">
          <UiResourcesPage />
        </div>
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
} satisfies Meta

export default meta
type Story = StoryObj

export const ImportYamlManifest: Story = {
  render: () => (
    <BackofficeProvider initialState={storyBackoffice}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={localDefaultUserId}
      >
        <div className="p-6">
          <UiResourceSyncPage />
        </div>
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 1, name: "UI 리소스 동기화" }),
    ).toBeVisible()
    const body = within(canvasElement.ownerDocument.body)
    const namespaceSelect = canvas.getByRole("combobox", {
      name: "네임스페이스",
    })
    await waitFor(() =>
      expect(namespaceSelect).toHaveTextContent("Backoffice (backoffice)"),
    )
    await userEvent.click(namespaceSelect)
    await userEvent.click(
      await body.findByRole("option", {
        name: "Story Console (story-console)",
      }),
    )
    await fireEvent.change(
      canvas.getByRole("textbox", { name: "Manifest 데이터" }),
      {
        target: {
          value: [
            "version: 1",
            "namespaceKey: story-console",
            "resources:",
            "  - key: services:list:catalogTable",
            "    parentKey: services:list",
            "    type: component",
            "    name: 서비스 카탈로그 테이블",
            "    description: 서비스 목록을 조회하는 UI 컴포넌트입니다.",
            "  - key: services:list",
            "    parentKey: services",
            "    type: view",
            "    name: 서비스 목록",
            "    description: Story Console 서비스 목록 화면입니다.",
            "  - key: services",
            "    parentKey: null",
            "    type: menu",
            "    name: 서비스",
            "    description: Story Console 서비스 메뉴입니다.",
          ].join("\n"),
        },
      },
    )
    await userEvent.click(canvas.getByRole("button", { name: "검토하기" }))
    await expect(canvas.getByText("추가 예정 3건")).toBeVisible()
    await expect(
      canvas.getByRole("checkbox", {
        name: /Backoffice 시스템 관리자에 동기화 대상 전체 접근 권한 부여/,
      }),
    ).toBeChecked()
    const selectionList = canvas
      .getByText("동기화 대상 선택")
      .closest("section")
      ?.querySelector("ul")
    if (!selectionList) throw new Error("UI resource selection list not found")
    const sortedOptions = within(selectionList).getAllByRole("checkbox")
    await expect(sortedOptions[0]).toHaveAccessibleName(/^services\b/)
    await expect(sortedOptions[1]).toHaveAccessibleName(/^services:list\b/)
    await expect(sortedOptions[2]).toHaveAccessibleName(
      /services:list:catalogTable/,
    )
    const componentTarget = canvas.getByRole("checkbox", {
      name: /services:list:catalogTable/,
    })
    await userEvent.click(componentTarget)
    await expect(canvas.getByText("추가 예정 2건")).toBeVisible()
    await userEvent.click(componentTarget)
    await expect(canvas.getByText("추가 예정 3건")).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "동기화" }))
    await expect(
      canvas.getByRole("heading", {
        name: "UI 리소스 동기화를 완료했습니다.",
      }),
    ).toBeVisible()
    await expect(canvas.getByRole("button", { name: "완료" })).toBeVisible()
  },
}

export const InheritsInactiveAncestorVisibility: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const resourceSearch = canvas.getByRole("searchbox", {
      name: "Resource key",
    })
    await userEvent.type(resourceSearch, "services")

    const getResourceRow = (resourceKey: string) => {
      const row = canvas
        .getAllByRole("row")
        .find(
          (candidate) =>
            within(candidate).queryAllByRole("cell")[0]?.textContent.trim() ===
            resourceKey,
        )
      if (!row) {
        throw new Error(`UI resource row is missing: ${resourceKey}`)
      }
      return row
    }
    const rootRow = getResourceRow("services")
    const childRow = getResourceRow("services:list:createService")
    const rootSwitch = within(rootRow).getByRole("switch", {
      name: "서비스 활성 상태 변경",
    })

    await expect(rootSwitch).toBeChecked()
    await expect(within(childRow).getByText("노출")).toBeVisible()
    await userEvent.click(rootSwitch)

    await waitFor(() =>
      expect(
        within(getResourceRow("services")).getByRole("switch", {
          name: "서비스 활성 상태 변경",
        }),
      ).not.toBeChecked(),
    )
    await expect(
      within(getResourceRow("services")).getByText("비활성"),
    ).toBeVisible()
    await expect(
      within(getResourceRow("services:list:createService")).getByText(
        "상위 비활성",
      ),
    ).toBeVisible()

    await userEvent.click(
      within(getResourceRow("services")).getByRole("switch", {
        name: "서비스 활성 상태 변경",
      }),
    )

    await waitFor(() =>
      expect(
        within(getResourceRow("services")).getByRole("switch", {
          name: "서비스 활성 상태 변경",
        }),
      ).toBeChecked(),
    )
    await expect(
      within(getResourceRow("services:list:createService")).getByText("노출"),
    ).toBeVisible()
  },
}
