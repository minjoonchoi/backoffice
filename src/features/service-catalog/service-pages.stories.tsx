import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { localDefaultUserId, localFixture } from "@/mocks/fixture"
import {
  ServiceEndpointDetailPage,
  ServiceDetailPage,
  ServiceEndpointsPage,
  ServicesPage,
} from "@/features/service-catalog/service-pages"
import {
  ServiceEditorPage,
  ServiceEndpointEditorPage,
} from "@/features/service-catalog/service-editor-pages"
import { BackofficeProvider } from "@/application/state/provider"

function findUserId(nickname: string) {
  const user = localFixture.users.find((item) => item.nickname === nickname)
  if (!user) throw new Error(`Service page story user not found: ${nickname}`)
  return user.id
}

const meta = {
  title: "Access Governance/Service registration permissions",
  parameters: { layout: "fullscreen" },
} satisfies Meta

export default meta
type Story = StoryObj

export const AdministratorServices: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={localDefaultUserId}
      >
        <ServicesPage />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.queryByRole("heading", { name: "서비스 등록" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.getByRole("button", { name: "서비스 등록" }),
    ).toHaveAttribute("href", "/services/new")
    await expect(
      canvas.queryByRole("combobox", { name: "환경" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("combobox", { name: "담당자" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.getAllByText("내부 서비스", { selector: '[data-slot="badge"]' }),
    ).toHaveLength(3)
    await expect(
      canvas.getByText("외부 서비스", { selector: '[data-slot="badge"]' }),
    ).toBeVisible()
    await expect(canvas.queryAllByRole("switch")).toHaveLength(0)
  },
}

export const OrganizationLeaderServices: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={findUserId("Emma")}
      >
        <ServiceEditorPage />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 1, name: "서비스 등록" }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("combobox", { name: "소유 조직" }),
    ).not.toBeInTheDocument()
    await expect(canvas.getByText("개발 2팀")).toBeVisible()
    await userEvent.type(
      canvas.getByRole("textbox", { name: "이름" }),
      "팀 API",
    )
    await userEvent.type(
      canvas.getByRole("textbox", { name: "서비스 키" }),
      "team-api",
    )
    await userEvent.type(
      canvas.getByRole("textbox", { name: "호스트" }),
      "https://team-api.example.com",
    )
    await userEvent.click(canvas.getByRole("combobox", { name: "서비스 유형" }))
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      await body.findByRole("option", { name: "내부 서비스" }),
    )
    await expect(canvas.getByRole("button", { name: "다음" })).toBeEnabled()
    await expect(
      canvas.queryByRole("combobox", { name: "API Key 발급 결재 템플릿" }),
    ).not.toBeInTheDocument()
  },
}

export const DefaultAccessServices: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <ServicesPage />
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 1, name: "서비스" }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("button", { name: "서비스 등록" }),
    ).not.toBeInTheDocument()
  },
}

export const AdministratorEndpoints: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={localDefaultUserId}
      >
        <ServiceEndpointsPage />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("button", { name: "엔드포인트 등록" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "엔드포인트 등록" }),
    ).toHaveAttribute("href", "/service-endpoints/new")
    await expect(
      canvas.queryByRole("combobox", { name: "환경" }),
    ).not.toBeInTheDocument()
    const pathLink = canvas.getByRole("link", { name: "/health" })
    await expect(pathLink).toHaveAttribute(
      "href",
      "https://api.example.com/health",
    )
    const headers = canvas.getAllByRole("columnheader")
    const methodIndex = headers.findIndex(
      (header) => header.textContent === "메서드",
    )
    await expect(methodIndex).toBeGreaterThanOrEqual(0)
    await expect(
      canvasElement.querySelectorAll("col")[methodIndex],
    ).toHaveAttribute("style", "width: 80px;")
    await expect(
      canvas.getByRole("columnheader", { name: "상태" }),
    ).toBeVisible()
    await expect(canvas.getAllByText("사용 중")[0]).toBeVisible()
    await expect(
      canvas.getByRole("columnheader", { name: "서비스" }),
    ).toBeVisible()
    await expect(canvas.queryAllByRole("switch")).toHaveLength(0)
    await expect(
      canvas.queryByRole("columnheader", { name: "작업" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("button", { name: "수정" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("button", { name: "삭제" }),
    ).not.toBeInTheDocument()
  },
}

export const OrganizationLeaderEndpoints: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <SessionAccessProvider
        localSwitchingEnabled
        initialUserId={findUserId("Emma")}
      >
        <ServiceEndpointEditorPage />
      </SessionAccessProvider>
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", {
        level: 1,
        name: "엔드포인트 등록",
      }),
    ).toBeVisible()
    const nextButton = canvas.getByRole("button", { name: "다음" })
    await expect(nextButton).toBeEnabled()
    await userEvent.click(nextButton)
    await expect(canvas.getByRole("textbox", { name: "이름" })).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    await expect(canvas.getAllByRole("alert").length).toBeGreaterThan(0)
    const body = within(canvasElement.ownerDocument.body)
    const serviceSelect = canvas.getByRole("combobox", { name: "서비스" })
    serviceSelect.focus()
    await userEvent.keyboard("{Enter}")
    await body.findByRole("listbox")
    await expect(
      body.getByRole("option", { name: "Developer API" }),
    ).toBeInTheDocument()
    await expect(
      body.queryByRole("option", { name: "협업 SaaS" }),
    ).not.toBeInTheDocument()
    await userEvent.keyboard("{Escape}")
  },
}

export const DefaultAccessEndpoints: Story = {
  render: () => (
    <BackofficeProvider initialState={localFixture}>
      <ServiceEndpointsPage />
    </BackofficeProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", {
        level: 1,
        name: "엔드포인트",
      }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("button", { name: "엔드포인트 등록" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("button", { name: "수정" }),
    ).not.toBeInTheDocument()
  },
}

export const ServiceDetailReadOnlyStatus: Story = {
  render: () => {
    const service = localFixture.services[0]
    if (!service) throw new Error("Service detail story requires a service")
    return (
      <BackofficeProvider initialState={localFixture}>
        <SessionAccessProvider
          localSwitchingEnabled
          initialUserId={findUserId("Daniel")}
        >
          <ServiceDetailPage serviceId={service.id} />
        </SessionAccessProvider>
      </BackofficeProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Developer API" }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("button", { name: "서비스 수정" }),
    ).not.toBeInTheDocument()
    const endpointTable = canvas.getByRole("table", {
      name: "서비스 엔드포인트 목록",
    })
    await expect(
      within(endpointTable).queryByRole("columnheader", { name: "서비스" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.getByRole("button", { name: "요청하기" }),
    ).toHaveAttribute(
      "href",
      "/credentials/request?serviceId=60000000-0000-4000-8000-000000000001",
    )
    await expect(canvas.queryAllByRole("switch")).toHaveLength(0)
  },
}

export const OwnedCredentialHidesServiceRequest: Story = {
  render: () => {
    const service = localFixture.services.find(
      (candidate) => candidate.name === "Developer API",
    )
    if (!service) throw new Error("Credential service fixture is missing")
    return (
      <BackofficeProvider initialState={localFixture}>
        <SessionAccessProvider
          localSwitchingEnabled
          initialUserId={findUserId("Amelia")}
        >
          <ServiceDetailPage serviceId={service.id} />
        </SessionAccessProvider>
      </BackofficeProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.queryByRole("button", { name: "요청하기" }),
    ).not.toBeInTheDocument()
  },
}

export const OrganizationLeaderDetail: Story = {
  render: () => {
    const service = localFixture.services.find(
      (item) => item.name === "Developer API",
    )
    if (!service) throw new Error("Service detail story requires a service")
    return (
      <BackofficeProvider initialState={localFixture}>
        <SessionAccessProvider
          localSwitchingEnabled
          initialUserId={findUserId("Emma")}
        >
          <ServiceDetailPage serviceId={service.id} />
        </SessionAccessProvider>
      </BackofficeProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("button", { name: "서비스 수정" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "서비스 수정" }),
    ).toHaveAttribute(
      "href",
      "/services/60000000-0000-4000-8000-000000000001/edit",
    )
    await expect(
      canvas.queryByRole("columnheader", { name: "작업" }),
    ).not.toBeInTheDocument()
    await expect(canvas.getAllByRole("button", { name: "삭제" })).toHaveLength(
      1,
    )
  },
}

export const AdministratorEndpointDetail: Story = {
  render: () => {
    const endpoint = localFixture.serviceEndpoints.find(
      (item) => item.name === "이벤트 API",
    )
    if (!endpoint) throw new Error("Endpoint detail story requires an endpoint")
    return (
      <BackofficeProvider initialState={localFixture}>
        <SessionAccessProvider
          localSwitchingEnabled
          initialUserId={localDefaultUserId}
        >
          <ServiceEndpointDetailPage endpointId={endpoint.id} />
        </SessionAccessProvider>
      </BackofficeProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 1, name: "이벤트 API" }),
    ).toBeVisible()
    await expect(canvas.getByText("$['x-request-id']")).toBeVisible()
    await expect(
      canvas.getByText("71000000-0000-4000-8000-000000000002"),
    ).toBeVisible()
    await expect(
      canvas.getByRole("heading", { name: "요청 본문 필드" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("heading", { name: "응답 본문 필드" }),
    ).toBeVisible()
    await expect(canvas.getByText(/eventType/)).toBeVisible()
    await expect(canvas.getByText(/accepted/)).toBeVisible()
    await expect(
      canvas.getByRole("heading", { name: "포함된 정책" }),
    ).toBeVisible()
    await expect(
      canvas.getByText("Developer API 이벤트 발행 거부"),
    ).toBeVisible()
    await expect(canvas.getByRole("button", { name: "수정" })).toBeVisible()
    await expect(canvas.getByRole("button", { name: "삭제" })).toBeVisible()

    const body = within(canvasElement.ownerDocument.body)
    await expect(
      canvas.getByRole("button", { name: "수정" }).getAttribute("href"),
    ).toMatch(/^\/service-endpoints\/.+\/edit$/)

    await userEvent.click(canvas.getByRole("button", { name: "삭제" }))
    const deleteHeading = await body.findByRole("heading", {
      name: "이벤트 API 엔드포인트를 삭제할까요?",
    })
    await waitFor(() => expect(deleteHeading).toBeVisible())
    await userEvent.keyboard("{Escape}")
  },
}

export const EndpointEditReviewsFieldAndPolicyImpact: Story = {
  render: () => {
    const endpoint = localFixture.serviceEndpoints.find(
      (item) => item.name === "이벤트 API",
    )
    if (!endpoint) throw new Error("Endpoint edit story requires an endpoint")
    return (
      <BackofficeProvider initialState={localFixture}>
        <SessionAccessProvider
          localSwitchingEnabled
          initialUserId={localDefaultUserId}
        >
          <ServiceEndpointEditorPage endpointId={endpoint.id} />
        </SessionAccessProvider>
      </BackofficeProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await fireEvent.change(
      canvas.getByRole("textbox", { name: "요청 본문 필드" }),
      { target: { value: "[]" } },
    )
    await userEvent.click(canvas.getByRole("button", { name: "다음" }))

    await expect(
      canvas.getByRole("heading", { name: "엔드포인트 변경 영향" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole("table", { name: "필드별 변경 내용" }),
    ).toBeVisible()
    await expect(canvas.getAllByText("삭제").length).toBeGreaterThan(0)
    await expect(
      canvas.getByText("Developer API 이벤트 발행 거부"),
    ).toBeVisible()
  },
}

export const DefaultAccessEndpointDetail: Story = {
  render: () => {
    const endpoint = localFixture.serviceEndpoints[0]
    if (!endpoint) throw new Error("Endpoint detail story requires an endpoint")
    return (
      <BackofficeProvider initialState={localFixture}>
        <ServiceEndpointDetailPage endpointId={endpoint.id} />
      </BackofficeProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 1, name: "상태 확인 API" }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole("button", { name: "수정" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("button", { name: "삭제" }),
    ).not.toBeInTheDocument()
  },
}

export const ExternalServiceDetail: Story = {
  render: () => {
    const service = localFixture.services.find(
      (item) => item.type === "external",
    )
    if (!service) throw new Error("External service story requires a service")
    return (
      <BackofficeProvider initialState={localFixture}>
        <ServiceDetailPage serviceId={service.id} />
      </BackofficeProvider>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("외부 서비스")).toBeVisible()
    await expect(
      canvas.queryByRole("heading", { name: "서비스 엔드포인트" }),
    ).not.toBeInTheDocument()
  },
}
