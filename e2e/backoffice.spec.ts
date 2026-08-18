import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Locator, type Page } from "@playwright/test"

async function choose(
  page: Page,
  scope: Locator,
  label: string,
  option: string,
  index = 0,
) {
  await scope
    .getByRole("combobox", { name: label, exact: true })
    .nth(index)
    .click()
  await page
    .locator('[data-slot="select-content"][data-open]')
    .getByRole("option", { name: option, exact: true })
    .click()
}

async function waitForHydration(page: Page) {
  await expect(page.locator("[data-app-shell]")).toHaveAttribute(
    "data-hydrated",
    "true",
    { timeout: 15_000 },
  )
}

async function createUser(page: Page, nickname: string, email: string) {
  await page.getByRole("button", { name: "사용자 등록" }).click()
  await expect(page).toHaveURL(/\/users\/new$/)
  const editor = page.locator("main")
  await editor.getByRole("textbox", { name: "닉네임" }).fill(nickname)
  await editor.getByRole("textbox", { name: "이메일" }).fill(email)
  await choose(page, editor, "재직 상태", "재직")
  await expect(editor.locator('[data-slot="select-value"]')).toHaveText("재직")
  await editor.getByRole("checkbox", { name: "개발 1팀" }).check()
  await editor.getByRole("button", { name: "다음" }).click()
  await editor.getByRole("button", { name: "등록" }).click()
  await expect(page).toHaveURL(/\/users\/[0-9a-f-]+$/)
  await page.getByRole("link", { name: "사용자", exact: true }).click()
  await expect(page).toHaveURL(/\/users$/)

  const nicknameSearch = page.getByRole("searchbox", { name: "닉네임" })
  await nicknameSearch.fill(nickname)
  await expect(
    page.getByRole("cell", { name: nickname, exact: true }),
  ).toBeVisible()
  await nicknameSearch.clear()
}

async function createOrganization(
  page: Page,
  name: string,
  leader: string,
  parent?: string,
) {
  await page.getByRole("button", { name: "조직 등록" }).click()
  await expect(page).toHaveURL(/\/organizations\/new$/)
  const editor = page.locator("main")
  await editor.getByRole("textbox", { name: "조직명" }).fill(name)
  await choose(page, editor, "조직장", leader)
  if (parent) await choose(page, editor, "상위 조직", parent)
  await editor.getByRole("button", { name: "다음" }).click()
  await editor.getByRole("button", { name: "등록" }).click()
  await expect(page).toHaveURL(/\/organizations\/[0-9a-f-]+$/)
  await page.getByRole("link", { name: "조직", exact: true }).click()
  await expect(page).toHaveURL(/\/organizations$/)
}

async function createRole(page: Page, name: string, description: string) {
  await page.getByRole("button", { name: "역할 생성" }).click()
  await expect(page).toHaveURL(/\/roles\/new$/)
  const editor = page.locator("main")
  await editor.getByRole("textbox", { name: "역할 이름" }).fill(name)
  await editor.getByRole("textbox", { name: "설명" }).fill(description)
  await editor.getByRole("button", { name: "다음" }).click()
  await editor.getByRole("button", { name: "등록" }).click()
  await expect(page).toHaveURL(/\/roles\/[0-9a-f-]+$/)
  await page.getByRole("link", { name: "역할", exact: true }).click()
  await expect(page).toHaveURL(/\/roles$/)
}

async function switchSessionUser(page: Page, nickname: string) {
  await page.getByRole("button", { name: "사용자 메뉴" }).click()
  await page.getByRole("menuitem", { name: nickname, exact: true }).click()
}

async function processRequestStages(
  page: Page,
  requestRow: Locator,
  stages: readonly { actor: string; action: "승인" | "합의" | "확인" }[],
) {
  await requestRow.getByRole("cell").first().click()
  await expect(page).toHaveURL(/\/approval-documents\/requests\/[0-9a-f-]+$/)
  for (const stage of stages) {
    await switchSessionUser(page, stage.actor)
    await page.getByRole("button", { name: stage.action, exact: true }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "처리 완료" }).click()
    await expect(dialog).toBeHidden()
  }
  await expect(
    page.getByText("승인 완료", { exact: true }).first(),
  ).toBeVisible()
  await switchSessionUser(page, "David")
  await page.getByRole("link", { name: "자격증명", exact: true }).click()
}

test("uses a dedicated page for entity creation and resets after navigation", async ({
  page,
}) => {
  await page.goto("/services")
  await waitForHydration(page)

  await page.getByRole("button", { name: "서비스 등록" }).click()
  await expect(page).toHaveURL(/\/services\/new$/)
  const serviceName = page.getByRole("textbox", { name: "이름" })
  await serviceName.fill("임시 서비스")
  await page.getByRole("button", { name: "취소" }).click()
  await expect(page).toHaveURL(/\/services$/)

  await page.getByRole("button", { name: "서비스 등록" }).click()
  await expect(page.getByRole("textbox", { name: "이름" })).toHaveValue("")
})

test("keeps system management last and exposes the shared directory without IAM operations", async ({
  page,
}) => {
  await page.goto("/")
  await waitForHydration(page)

  const navigation = page.locator("#app-sidebar nav")
  await expect(navigation.locator("p")).toHaveText([
    "IAM",
    "서비스 카탈로그",
    "UI 카탈로그",
    "시스템 관리",
  ])
  await expect(
    navigation
      .getByText("서비스 카탈로그", { exact: true })
      .locator("..")
      .getByRole("link"),
  ).toHaveText(["서비스", "엔드포인트"])
  await expect(
    navigation
      .getByText("UI 카탈로그", { exact: true })
      .locator("..")
      .getByRole("link"),
  ).toHaveText(["네임스페이스", "UI 리소스"])
  await expect(
    navigation
      .getByText("시스템 관리", { exact: true })
      .locator("..")
      .getByRole("link"),
  ).toHaveText(["요청", "요청 템플릿", "감사"])

  const header = page.locator("header")
  const organizationCount = header.getByRole("button", { name: "소속 조직: 1" })
  await organizationCount.hover()
  await expect(
    page.getByRole("tooltip", { name: /소속 조직 개발 1팀/ }),
  ).toBeVisible()

  const roleCount = header.getByRole("button", { name: "유효 역할: 4" })
  await roleCount.hover()
  await expect(
    page.getByRole("tooltip", { name: /유효 역할 Backoffice 시스템 관리자/ }),
  ).toBeVisible()

  await page.locator("main").hover()

  const permissionTable = page.getByRole("table", {
    name: "세션 사용자 보유 정책 목록",
  })
  await expect(permissionTable).toBeVisible()
  await expect(permissionTable.getByText("운영 모니터링 허용")).toBeVisible()
  await expect(permissionTable.getByText("사용자 직접 부여")).toBeVisible()
  const additionalGrantPaths = permissionTable.getByRole("button", {
    name: "전체 부여 경로 4개",
  })
  await expect(additionalGrantPaths).toHaveText("외 3개")
  await additionalGrantPaths.hover()
  await expect(
    page.getByRole("tooltip").getByText("조직 · 개발 1팀"),
  ).toBeVisible()
  await page.locator("main").hover()
  await expect(page.getByText("승인 대기 요청", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "내 업무 정보" }).click()
  await expect(
    page.getByRole("dialog", { name: "내 업무 정보" }).getByText("개발 1팀"),
  ).toBeVisible()
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: "사용자 메뉴" }).click()
  await page.getByRole("menuitem", { name: "Emma" }).click()
  await expect(
    page.locator("header").getByRole("button", { name: "유효 역할: 2" }),
  ).toBeVisible()
  await expect(
    navigation.getByRole("link", { name: "사용자", exact: true }),
  ).toBeVisible()
  await expect(
    navigation.getByRole("link", { name: "조직", exact: true }),
  ).toBeVisible()
  await expect(navigation.getByRole("link", { name: "역할" })).toHaveCount(0)
  await expect(navigation.getByText("IAM", { exact: true })).toBeVisible()
  await expect(
    navigation.getByRole("link", { name: "어플리케이션", exact: true }),
  ).toBeVisible()
  await expect(
    navigation.getByText("시스템 관리", { exact: true }),
  ).toHaveCount(0)

  await navigation
    .getByRole("link", { name: "어플리케이션", exact: true })
    .click()
  await expect(
    page.getByText("Developer Console", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("Platform Automation", { exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "어플리케이션 등록" }),
  ).toBeVisible()
  await page.getByText("Developer Console", { exact: true }).click()
  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]+$/)
  const applicationEdit = page.getByRole("button", {
    name: "어플리케이션 수정",
  })
  await expect(applicationEdit).toBeVisible()
  const applicationDelete = page.getByRole("button", { name: "삭제" })
  await expect(applicationDelete).toBeDisabled()
  await expect(applicationDelete).toHaveAttribute(
    "title",
    "유효한 자격증명이 있어 삭제할 수 없습니다.",
  )
  await applicationEdit.click()
  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]+\/edit$/)
  await expect(
    page.getByRole("heading", { name: "어플리케이션 수정" }),
  ).toBeVisible()

  await navigation.getByRole("link", { name: "홈", exact: true }).click()
  const credentialTable = page.getByRole("table", {
    name: "세션 사용자 관련 자격증명 목록",
  })
  await expect(credentialTable.getByText("local-integration-key")).toBeVisible()
  await expect(credentialTable.getByText("Developer API")).toBeVisible()
  await expect(credentialTable.getByText("개발 2팀")).toBeVisible()
  await expect(
    credentialTable.getByText("어플리케이션 소유 조직"),
  ).toBeVisible()

  await page.getByRole("button", { name: "사용자 메뉴" }).click()
  await page.getByRole("menuitem", { name: "Owen" }).click()
  await expect(navigation.getByText("IAM", { exact: true })).toBeVisible()
  for (const menuName of ["사용자", "조직", "역할"]) {
    await expect(
      navigation.getByRole("link", { name: menuName, exact: true }),
    ).toBeVisible()
  }
  await expect(
    navigation.getByText("시스템 관리", { exact: true }),
  ).toHaveCount(0)
  await navigation.getByRole("link", { name: "사용자", exact: true }).click()
  await expect(page.getByRole("button", { name: "사용자 등록" })).toBeVisible()

  await page.getByRole("button", { name: "사용자 메뉴" }).click()
  const generalUserSessionRefresh = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return url.pathname === "/users" && response.request().method() === "GET"
  })
  await page.getByRole("menuitem", { name: "Charlotte" }).click()
  await generalUserSessionRefresh
  for (const menuName of [
    "홈",
    "사용자",
    "조직",
    "어플리케이션",
    "정책",
    "자격증명",
    "서비스",
    "엔드포인트",
  ]) {
    await expect(
      navigation.getByRole("link", { name: menuName, exact: true }),
    ).toBeVisible()
  }
  await expect(navigation.getByText("IAM", { exact: true })).toBeVisible()
  await expect(
    navigation.getByRole("link", { name: "역할", exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("heading", { level: 2, name: "접근 권한이 없습니다" }),
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: "사용자 등록" })).toHaveCount(0)
  await expect(page.getByText("Olivia", { exact: true })).toHaveCount(0)
  await navigation.getByRole("link", { name: "조직", exact: true }).click()
  await expect(page.getByRole("button", { name: "조직 등록" })).toHaveCount(0)
  await navigation.getByRole("link", { name: "정책", exact: true }).click()
  await expect(page).toHaveURL(/\/approval-documents$/)
  await waitForHydration(page)
  await expect(page.getByText("운영 모니터링 허용")).toBeVisible()
  await expect(page.getByText("Developer API 이벤트 발행 거부")).toBeVisible()

  await navigation.getByRole("link", { name: "자격증명", exact: true }).click()
  await expect(page.getByText("local-integration-key")).toHaveCount(0)
  await navigation.getByRole("link", { name: "홈", exact: true }).click()
  const grantedAccessTable = page.getByRole("table", {
    name: "세션 사용자 보유 정책 목록",
  })
  await expect(
    grantedAccessTable.getByText("운영 모니터링 허용", {
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    grantedAccessTable
      .getByRole("row", { name: /운영 모니터링 허용/ })
      .getByText("허용", { exact: true }),
  ).toBeVisible()
  await expect(
    grantedAccessTable.getByText("사용자 직접 부여", { exact: true }),
  ).toBeVisible()
})

test("does not expose the post-MVP notification list on home", async ({
  page,
}) => {
  await page.goto("/")
  await waitForHydration(page)
  await page.getByRole("button", { name: "사용자 메뉴" }).click()
  await page.getByRole("menuitem", { name: "Charlotte" }).click()

  await expect(page.getByRole("heading", { name: "내 알림" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "읽음 처리" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "요청 보기" })).toHaveCount(0)
})

test("removes list row navigation when its detail view is inactive", async ({
  page,
}) => {
  await page.goto("/")
  await waitForHydration(page)
  await switchSessionUser(page, "Owen")
  await page.getByRole("link", { name: "UI 리소스", exact: true }).click()
  await expect(page).toHaveURL(/\/ui-resources$/)
  await page
    .getByRole("searchbox", { name: "Resource key" })
    .fill("users:detail")
  const resourceRow = page
    .getByRole("table", { name: "UI 리소스 목록" })
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "users:detail" }) })
  await resourceRow
    .getByRole("switch", { name: "사용자 상세 활성 상태 변경" })
    .click()
  await expect(resourceRow.getByText("비활성", { exact: true })).toBeVisible()

  await switchSessionUser(page, "David")
  await page.getByRole("link", { name: "사용자", exact: true }).click()
  await expect(page).toHaveURL(/\/users$/)
  const userRow = page
    .getByRole("table", { name: "사용자 목록" })
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "David", exact: true }) })
  await expect(userRow).not.toHaveAttribute("tabindex")
  await expect(userRow).not.toHaveAttribute("aria-label")
  await userRow.getByRole("cell", { name: "David", exact: true }).click()
  await expect(page).toHaveURL(/\/users$/)
  await userRow.press("Enter")
  await expect(page).toHaveURL(/\/users$/)
})

test("isolates YAML UI Resources by a system namespace", async ({ page }) => {
  await page.goto("/")
  await waitForHydration(page)
  await page.getByRole("link", { name: "네임스페이스", exact: true }).click()
  await expect(page).toHaveURL(/\/namespaces$/)
  await page.getByRole("button", { name: "네임스페이스 추가" }).click()
  await expect(page).toHaveURL(/\/namespaces\/new$/)
  const namespaceEditor = page.locator("main")
  await namespaceEditor
    .getByRole("textbox", { name: "네임스페이스 key" })
    .fill("integration-console")
  await namespaceEditor
    .getByRole("textbox", { name: "이름" })
    .fill("Integration Console")
  await namespaceEditor
    .getByRole("textbox", { name: "설명" })
    .fill("통합 시스템 UI 리소스를 격리합니다.")
  await choose(page, namespaceEditor, "관리 역할", "Backoffice 시스템 관리자")
  await namespaceEditor.getByRole("button", { name: "다음" }).click()
  await namespaceEditor.getByRole("button", { name: "등록" }).click()
  await expect(page).toHaveURL(/\/namespaces\/[0-9a-f-]+$/)

  await page.getByRole("link", { name: "UI 리소스", exact: true }).click()
  await expect(page).toHaveURL(/\/ui-resources$/)
  await page.getByRole("button", { name: "UI 리소스 동기화" }).click()
  await expect(page).toHaveURL(/\/ui-resources\/sync$/)
  const dialog = page.locator("main")
  await choose(
    page,
    dialog,
    "네임스페이스",
    "Integration Console (integration-console)",
  )
  await dialog
    .getByRole("textbox", { name: "Manifest 데이터" })
    .fill(
      [
        "version: 1",
        "namespaceKey: integration-console",
        "resources:",
        "  - key: services",
        "    parentKey: null",
        "    type: menu",
        "    name: 서비스",
        "    description: 통합 시스템의 서비스 메뉴입니다.",
        "  - key: services:list",
        "    parentKey: services",
        "    type: view",
        "    name: 서비스 목록",
        "    description: 통합 시스템의 서비스 목록 화면입니다.",
        "  - key: services:list:catalogToolbar",
        "    parentKey: services:list",
        "    type: component",
        "    name: 서비스 카탈로그 도구 모음",
        "    description: 서비스 목록 작업을 제공하는 UI 컴포넌트입니다.",
      ].join("\n"),
    )
  await dialog.getByRole("button", { name: "검토하기" }).click()
  await expect(dialog.getByText("추가 예정 3건")).toBeVisible()
  await dialog.getByRole("button", { name: "동기화" }).click()
  await expect(
    dialog.getByRole("heading", {
      name: "UI 리소스 동기화를 완료했습니다.",
    }),
  ).toBeVisible()
  await dialog.getByRole("button", { name: "완료" }).click()
  await expect(page).toHaveURL(/\/ui-resources$/)
  await page.getByRole("searchbox", { name: "Resource key" }).fill("services")
  const resourceTable = page.getByRole("table", { name: "UI 리소스 목록" })
  await expect(
    resourceTable.getByRole("cell", { name: "services:list:catalogToolbar" }),
  ).toBeVisible()
  await expect(
    resourceTable.getByRole("cell", {
      name: "Integration Console",
      exact: true,
    }),
  ).toHaveCount(3)
  await expect(
    page.getByRole("columnheader", { name: "관리자 접근" }),
  ).toHaveCount(0)
  const rootResourceRow = resourceTable
    .locator("tbody tr")
    .filter({
      has: page
        .locator("td:first-child code")
        .filter({ hasText: /^services$/ }),
    })
    .filter({ hasText: "Integration Console" })
  const childResourceRow = resourceTable
    .locator("tbody tr")
    .filter({
      has: page
        .locator("td:first-child code")
        .filter({ hasText: /^services:list:catalogToolbar$/ }),
    })
    .filter({ hasText: "Integration Console" })
  const rootResourceStatus = rootResourceRow.getByRole("switch", {
    name: "서비스 활성 상태 변경",
  })
  await expect(rootResourceStatus).toBeChecked()
  await expect(
    childResourceRow.getByText("노출", { exact: true }),
  ).toBeVisible()
  await rootResourceStatus.click()
  await expect(rootResourceStatus).not.toBeChecked()
  await expect(
    childResourceRow.getByText("상위 비활성", { exact: true }),
  ).toBeVisible()
  await rootResourceStatus.click()
  await expect(rootResourceStatus).toBeChecked()
  await expect(
    childResourceRow.getByText("노출", { exact: true }),
  ).toBeVisible()
  await page
    .getByRole("searchbox", { name: "Resource key" })
    .fill("services:list:catalogToolbar")

  await page.getByRole("button", { name: "UI 리소스 동기화" }).click()
  const orphanDialog = page.locator("main")
  await choose(
    page,
    orphanDialog,
    "네임스페이스",
    "Integration Console (integration-console)",
  )
  const testResourceEntries = Array.from({ length: 18 }, (_, index) => {
    const resourceNumber = String(index + 1)
    return [
      `  - key: services:list:testResource${resourceNumber.padStart(2, "0")}`,
      "    parentKey: services:list",
      "    type: component",
      `    name: 테스트 리소스 ${resourceNumber}`,
      "    description: 긴 동기화 목록의 내부 스크롤을 검증합니다.",
    ]
  })
  const manifestPrefix = [
    "version: 1",
    "namespaceKey: integration-console",
    "resources:",
    "  - key: services",
    "    parentKey: null",
    "    type: menu",
    "    name: 서비스",
    "    description: 통합 시스템의 서비스 메뉴입니다.",
    "  - key: services:list",
    "    parentKey: services",
    "    type: view",
    "    name: 서비스 목록",
    "    description: 통합 시스템의 서비스 목록 화면입니다.",
    "  - key: services:list:catalogToolbar",
    "    parentKey: services:list",
    "    type: component",
    "    name: 서비스 카탈로그 도구 모음",
    "    description: 서비스 목록 작업을 제공하는 UI 컴포넌트입니다.",
  ]
  await orphanDialog
    .getByRole("textbox", { name: "Manifest 데이터" })
    .fill([...manifestPrefix, ...testResourceEntries.flat()].join("\n"))
  await orphanDialog.getByRole("button", { name: "검토하기" }).click()
  const selectionList = orphanDialog.getByRole("list", {
    name: "동기화 대상 선택",
  })
  await expect(selectionList.getByRole("checkbox")).toHaveCount(21)
  await expect(
    selectionList.getByRole("checkbox", {
      name: /services:list:testResource18/,
    }),
  ).toBeVisible()
  await expect(orphanDialog.getByText("고아 표시 예정 0건")).toBeVisible()
  await orphanDialog
    .getByRole("checkbox", { name: /services:list:catalogToolbar/ })
    .uncheck()
  await expect(orphanDialog.getByText("고아 표시 예정 1건")).toBeVisible()
  const synchronizeButton = orphanDialog.getByRole("button", {
    name: "동기화",
  })
  await expect(synchronizeButton).toBeInViewport()
  await synchronizeButton.click()
  const completionOrphan = orphanDialog.getByRole("checkbox", {
    name: /services:list:catalogToolbar/,
  })
  await completionOrphan.uncheck()
  await orphanDialog.getByRole("button", { name: "완료" }).click()
  await expect(page).toHaveURL(/\/ui-resources$/)
  await page
    .getByRole("searchbox", { name: "Resource key" })
    .fill("services:list:catalogToolbar")
  const orphanedResourceRow = page
    .getByRole("table", { name: "UI 리소스 목록" })
    .locator("tbody tr")
    .filter({
      has: page.getByRole("cell", {
        name: "services:list:catalogToolbar",
        exact: true,
      }),
    })
  await expect(
    orphanedResourceRow.getByText("고아", { exact: true }),
  ).toBeVisible()

  await page.getByRole("button", { name: "UI 리소스 동기화" }).click()
  const restoreDialog = page.locator("main")
  await choose(
    page,
    restoreDialog,
    "네임스페이스",
    "Integration Console (integration-console)",
  )
  await restoreDialog
    .getByRole("textbox", { name: "Manifest 데이터" })
    .fill(
      [...manifestPrefix, ...testResourceEntries.slice(0, -1).flat()].join(
        "\n",
      ),
    )
  await restoreDialog.getByRole("button", { name: "검토하기" }).click()
  await expect(restoreDialog.getByText("고아 해제 예정 1건")).toBeVisible()
  await expect(restoreDialog.getByText("고아 표시 예정 1건")).toBeVisible()
  await restoreDialog.getByRole("button", { name: "동기화" }).click()
  await restoreDialog.getByRole("button", { name: "완료" }).click()
  await expect(page).toHaveURL(/\/ui-resources$/)
  await page
    .getByRole("searchbox", { name: "Resource key" })
    .fill("services:list:catalogToolbar")
  const restoredResourceRow = resourceTable.locator("tbody tr").filter({
    has: page.getByRole("cell", {
      name: "services:list:catalogToolbar",
      exact: true,
    }),
  })
  await expect(
    restoredResourceRow.getByText("노출", { exact: true }),
  ).toBeVisible()
  await page
    .getByRole("searchbox", { name: "Resource key" })
    .fill("services:list:testResource18")
  const newlyOrphanedResourceRow = resourceTable.locator("tbody tr").filter({
    has: page.getByRole("cell", {
      name: "services:list:testResource18",
      exact: true,
    }),
  })
  await expect(
    newlyOrphanedResourceRow.getByText("고아", { exact: true }),
  ).toBeVisible()

  await page.getByRole("button", { name: "고아 리소스 1건 정리" }).click()
  const cleanupDialog = page.getByRole("dialog", {
    name: "고아 UI 리소스를 삭제할까요?",
  })
  const cleanupCheckbox = cleanupDialog.getByRole("checkbox", {
    name: /services:list:testResource18/,
  })
  await cleanupCheckbox.uncheck()
  await expect(
    cleanupDialog.getByRole("button", { name: "선택 0건 삭제" }),
  ).toBeDisabled()
  await cleanupCheckbox.check()
  await cleanupDialog.getByRole("button", { name: "선택 1건 삭제" }).click()
  await expect(cleanupDialog).toBeHidden()
  await expect(page.getByText("조건에 맞는 항목이 없습니다.")).toBeVisible()

  const results = await new AxeBuilder({ page })
    .disableRules(["color-contrast"])
    .analyze()
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([])
})

test("opens endpoint details and keeps mutations out of endpoint tables", async ({
  page,
}) => {
  await page.goto("/service-endpoints")
  await waitForHydration(page)

  await expect(page.getByRole("columnheader", { name: "작업" })).toHaveCount(0)
  await page
    .getByRole("row", { name: "이벤트 API 상세 보기" })
    .getByRole("cell", { name: "이벤트 API", exact: true })
    .click()
  await expect(page).toHaveURL(/\/service-endpoints\/[0-9a-f-]+$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "이벤트 API" }),
  ).toBeVisible()
  await expect(page.getByText("$['x-request-id']")).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "요청 본문 필드" }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "응답 본문 필드" }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "수정" })).toBeVisible()
  await expect(page.getByRole("button", { name: "삭제" })).toBeVisible()

  await page.getByRole("link", { name: "Developer API", exact: true }).click()
  const endpointTable = page.getByRole("table", {
    name: "서비스 엔드포인트 목록",
  })
  await expect(
    endpointTable.getByRole("columnheader", { name: "작업" }),
  ).toHaveCount(0)
  await expect(
    endpointTable.getByRole("columnheader", { name: "서비스" }),
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: "요청하기" })).toHaveCount(0)
})

test("starts access policy requests from the selected policy detail", async ({
  page,
}) => {
  await page.goto("/approval-documents")
  await waitForHydration(page)

  await page.getByRole("button", { name: "신규 정책 생성" }).click()
  await expect(page).toHaveURL(/\/approval-documents\/new$/)
  let dialog = page.locator("main")
  await expect(dialog.getByRole("combobox", { name: "정책 유형" })).toHaveCount(
    0,
  )
  await dialog
    .getByRole("textbox", { name: "정책 이름" })
    .fill("감사 이벤트 조회 허용")
  await dialog
    .getByRole("textbox", { name: "정책 설명" })
    .fill("감사 이벤트 조회에 필요한 엔드포인트를 허용합니다.")
  await expect(
    dialog.getByRole("combobox", { name: "리소스 접근 효과" }),
  ).toBeVisible()
  await expect(
    dialog.getByRole("radio", { name: /UI 기능 사용/ }),
  ).toBeChecked()
  await expect(dialog.getByRole("tab")).toHaveCount(2)
  await dialog.getByRole("radio", { name: /Backoffice.*backoffice/ }).check()
  await dialog
    .getByRole("searchbox", { name: "포함 UI 리소스 선택" })
    .fill("UI 리소스 동기화")
  await dialog
    .getByRole("checkbox", {
      name: /UI 리소스 동기화 uiResources:list:importUiResources/,
    })
    .check()
  await dialog.getByRole("tab", { name: "엔드포인트" }).click()
  await dialog
    .getByRole("radio", { name: /Audit API.*audit-api\.example\.com/ })
    .check()
  await dialog
    .getByRole("checkbox", { name: /GET.*\/v1\/audit-events/ })
    .check()
  const selectedResources = dialog.getByRole("complementary", {
    name: "선택한 리소스",
  })
  await selectedResources.getByRole("tab", { name: /엔드포인트/ }).click()
  await expect(selectedResources).toContainText("Audit API")
  await expect(selectedResources).toContainText("GET /v1/audit-events")
  const selectedResourceRow = selectedResources.locator("tbody tr").first()
  const selectedResourceRowBox = await selectedResourceRow.boundingBox()
  expect(selectedResourceRowBox).not.toBeNull()
  if (selectedResourceRowBox) {
    expect(selectedResourceRowBox.height).toBeLessThanOrEqual(96)
  }
  await dialog.getByRole("button", { name: "다음" }).last().click()
  await expect(
    dialog.getByRole("heading", { name: "정책 구성을 검토하세요" }),
  ).toBeVisible()
  await expect(dialog.getByText("감사 이벤트 조회 허용")).toBeVisible()
  await expect(dialog.getByText("정책 유형", { exact: true })).toHaveCount(0)
  await expect(dialog.getByText("요청 템플릿", { exact: true })).toHaveCount(0)
  await expect(dialog.getByText("권한 부여 요청 템플릿")).toHaveCount(0)
  await dialog.getByRole("button", { name: "등록" }).click()
  await expect(page).toHaveURL(/\/approval-documents\/[0-9a-f-]+$/)
  await page.getByRole("link", { name: "정책", exact: true }).click()
  await switchSessionUser(page, "Daniel")
  await expect(
    page.getByRole("cell", { name: "감사 이벤트 조회 허용", exact: true }),
  ).toBeVisible()

  const policyName = "운영 모니터링 허용"
  await expect(
    page.getByRole("button", { name: "접근 정책 요청" }),
  ).toHaveCount(0)
  await page
    .getByRole("searchbox", { name: "정책 이름" })
    .first()
    .fill(policyName)
  const policyRow = page.getByRole("row", { name: new RegExp(policyName) })
  await expect(policyRow.getByText("미보유", { exact: true })).toBeVisible()
  await expect(policyRow.getByRole("button", { name: "요청" })).toHaveCount(0)

  await policyRow.getByRole("cell", { name: policyName, exact: true }).click()
  await expect(page).toHaveURL(/\/approval-documents\/[0-9a-f-]+$/)
  await page.getByRole("button", { name: "요청하기" }).click()
  await expect(page).toHaveURL(/\/approval-documents\/[0-9a-f-]+\/request$/)
  dialog = page.locator("main")
  await expect(dialog.getByRole("searchbox")).toHaveCount(0)
  await expect(
    dialog.getByRole("heading", { name: "요청 대상을 선택하세요" }),
  ).toBeVisible()
  await expect(dialog.getByText(policyName, { exact: true })).toBeVisible()
  await choose(page, dialog, "요청자", "Daniel")
  await expect(
    dialog.getByRole("combobox", { name: "요청 조직" }),
  ).toContainText("개인정보보호팀")
  await expect(
    dialog.getByRole("heading", {
      name: "요청 사유를 입력하세요",
    }),
  ).toBeVisible()
  await dialog
    .getByRole("textbox", { name: "요청 사유 및 내용" })
    .fill("운영 상태 확인을 위해 접근 권한이 필요합니다.")
  const grantExpiration = new Date()
  grantExpiration.setUTCFullYear(grantExpiration.getUTCFullYear() + 1)
  await dialog
    .getByRole("textbox", { name: "부여 만료 일시" })
    .fill(grantExpiration.toISOString().slice(0, 16))
  await dialog.getByRole("button", { name: "다음" }).click()
  await expect(
    dialog.getByRole("heading", { name: "요청 내용을 검토하세요" }),
  ).toBeVisible()
  await expect(
    dialog.getByText("Daniel", { exact: true }).first(),
  ).toBeVisible()
  await expect(
    dialog.getByText("개인정보보호팀", { exact: true }).first(),
  ).toBeVisible()
  await expect(
    dialog.getByRole("heading", { name: "요청 결재선" }),
  ).toBeVisible()
  await expect(
    dialog.getByRole("button", { name: "처리 단계 추가" }),
  ).toBeVisible()
  await expect(dialog.getByRole("button", { name: "이전" })).toBeVisible()
  await expect(
    dialog.getByRole("button", { name: "접근 정책 부여 요청 제출" }),
  ).toBeEnabled()
})

test("policy creation page keeps necessary steps within 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto("/approval-documents")
  await waitForHydration(page)

  await page.getByRole("button", { name: "신규 정책 생성" }).click()
  const dialog = page.locator("main")
  await expect(dialog.getByRole("combobox", { name: "정책 유형" })).toHaveCount(
    0,
  )
  await dialog
    .getByRole("textbox", { name: "정책 이름" })
    .fill("모바일 검토용 정책")
  await dialog
    .getByRole("textbox", { name: "정책 설명" })
    .fill("작은 화면의 정책 생성 흐름을 검증합니다.")
  await dialog.getByRole("radio", { name: /API 직접 호출/ }).check()
  await dialog
    .getByRole("radio", { name: /Audit API.*audit-api\.example\.com/ })
    .check()
  await dialog
    .getByRole("checkbox", { name: /GET.*\/v1\/audit-events/ })
    .check()
  await expect(
    dialog.getByRole("complementary", { name: "선택한 리소스" }),
  ).toContainText("Audit API")
  await dialog.getByRole("button", { name: "다음" }).last().click()
  await expect(
    dialog.getByRole("heading", { name: "정책 구성을 검토하세요" }),
  ).toBeVisible()

  const documentWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  )
  expect(documentWidth).toBeLessThanOrEqual(320)
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze()
  expect(
    results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([])
})

test("limits direct policy changes to policy operators and administrators", async ({
  page,
}) => {
  await page.goto("/approval-documents")
  await waitForHydration(page)

  await page.getByRole("button", { name: "사용자 메뉴" }).click()
  const sessionRefresh = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname === "/approval-documents" &&
      response.request().headers().rsc === "1"
    )
  })
  await page.getByRole("menuitem", { name: "Daniel" }).click()
  const sessionResponse = await sessionRefresh
  expect(await sessionResponse.finished()).toBeNull()
  await page.waitForLoadState("networkidle")
  await expect(
    page.getByRole("table", { name: "권한 정책 목록" }),
  ).toBeVisible()
  await expect(
    page.getByRole("table", { name: "접근 정책 부여 요청 목록" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "신규 정책 생성" }),
  ).toHaveCount(0)
  const catalog = page.getByRole("table", { name: "권한 정책 목록" })
  await catalog
    .getByRole("row", { name: /운영 모니터링 허용/ })
    .getByRole("cell", { name: "운영 모니터링 허용", exact: true })
    .click()
  await expect(page).toHaveURL(/\/approval-documents\/[^/]+$/)
  await expect(page.getByRole("button", { name: "정책 수정" })).toHaveCount(0)

  await page.goto("/approval-documents")
  await waitForHydration(page)

  await page.getByRole("button", { name: "사용자 메뉴" }).click()
  await page.getByRole("menuitem", { name: "Owen" }).click()
  await expect(
    page.getByRole("button", { name: "신규 정책 생성" }),
  ).toBeVisible()
  await catalog
    .getByRole("row", { name: /운영 모니터링 허용/ })
    .getByRole("cell", { name: "운영 모니터링 허용", exact: true })
    .click()
  await expect(page).toHaveURL(/\/approval-documents\/[^/]+$/)
  await expect(page.getByRole("button", { name: "정책 수정" })).toBeVisible()
})

test("reviews assigned policy impact and applies an authorized change directly", async ({
  page,
}) => {
  const policyName = "운영 모니터링 허용"
  const updatedDescription =
    "운영자가 영향 대상 검토를 마친 뒤 운영 모니터링 리소스 변경을 반영합니다."

  await page.goto("/approval-documents")
  await waitForHydration(page)
  await page.getByRole("button", { name: "사용자 메뉴" }).click()
  await page.getByRole("menuitem", { name: "Owen" }).click()
  await expect(
    page.getByRole("button", { name: "신규 정책 생성" }),
  ).toBeVisible()

  const catalog = page.getByRole("table", {
    name: "권한 정책 목록",
  })
  await catalog
    .getByRole("row", { name: new RegExp(policyName) })
    .getByRole("cell", { name: policyName, exact: true })
    .click()
  await expect(page.getByText(/현재 \d+개 .* 관계에 부여된 정책/)).toBeVisible()
  await page.getByRole("button", { name: "정책 수정" }).click()
  await expect(page).toHaveURL(/\/approval-documents\/[^/]+\/edit$/)
  const dialog = page.locator("main")
  await dialog
    .getByRole("textbox", { name: "정책 설명" })
    .fill(updatedDescription)
  await dialog.getByRole("button", { name: "변경 영향 검토" }).click()
  await expect(
    dialog.getByRole("heading", { name: "정책 변경 영향을 확인하세요" }),
  ).toBeVisible()
  await expect(
    dialog.getByText(
      "다른 활성 정책까지 계산한 결과 실제 리소스 접근은 변경되지 않습니다.",
    ),
  ).toBeVisible()
  await expect(
    dialog.getByRole("heading", { name: "저장 후 알림" }),
  ).toBeVisible()
  await expect(
    dialog.getByRole("table", {
      name: "정책 변경에 따른 실제 리소스 접근 영향 목록",
    }),
  ).toHaveCount(0)
  await dialog.getByRole("button", { name: "저장" }).click()
  await expect(page).toHaveURL(/\/approval-documents\/[^/]+$/)
  await expect(page.getByText(updatedDescription)).toBeVisible()
})

test("creates and approves an API key issuance request", async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto("/users")
  await waitForHydration(page)
  await createUser(page, "minjoon", "minjoon@example.com")

  await page.getByRole("link", { name: "어플리케이션" }).click()
  await page.getByRole("button", { name: "어플리케이션 등록" }).click()
  await expect(page).toHaveURL(/\/applications\/new$/)
  let dialog = page.locator("main")
  await dialog
    .getByRole("textbox", { name: "어플리케이션 이름" })
    .fill("Partner Integration")
  await dialog
    .getByRole("textbox", { name: "어플리케이션 키" })
    .fill("partner_integration")
  await dialog
    .getByRole("textbox", { name: "설명" })
    .fill("파트너 API를 호출하는 테스트 어플리케이션입니다.")
  await choose(page, dialog, "소유 조직", "개발 1팀")
  await dialog.getByRole("button", { name: "다음" }).click()
  await dialog.getByRole("button", { name: "등록" }).click()
  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]+$/)
  const applicationDetailUrl = page.url()
  await page.getByRole("button", { name: "자격증명 생성" }).click()
  await expect(page).toHaveURL(
    /\/credentials\/request\?applicationId=[0-9a-f-]+$/,
  )
  await expect(
    page.getByRole("radio", { name: /Partner Integration/ }),
  ).toBeChecked()
  await page.getByRole("radio", { name: /Developer API/ }).click()
  await expect(page.getByRole("combobox", { name: "요청 조직" })).toContainText(
    "개발 1팀",
  )
  await page.goBack()
  await expect(page).toHaveURL(applicationDetailUrl)

  await page.getByRole("link", { name: "조직" }).click()
  await createOrganization(page, "플랫폼 운영", "Owen")
  await expect(
    page.getByRole("cell", { name: "플랫폼 운영", exact: true }),
  ).toBeVisible()

  await page.getByRole("link", { name: "서비스", exact: true }).click()
  await page.getByRole("button", { name: "서비스 등록" }).click()
  await expect(page).toHaveURL(/\/services\/new$/)
  dialog = page.locator("main")
  await dialog.getByRole("textbox", { name: "이름" }).fill("파트너 API")
  await dialog.getByRole("textbox", { name: "서비스 키" }).fill("partner-api")
  await dialog
    .getByRole("textbox", { name: "호스트" })
    .fill("https://partner.example.com")
  await choose(page, dialog, "서비스 유형", "내부 서비스")
  await choose(page, dialog, "소유 조직", "플랫폼 운영")
  await dialog.getByRole("button", { name: "다음" }).click()
  await dialog.getByRole("button", { name: "등록" }).click()
  await expect(page).toHaveURL(/\/services\/[0-9a-f-]+$/)

  await page.getByRole("link", { name: "엔드포인트", exact: true }).click()
  for (const endpoint of [
    { name: "파트너 조회 API", method: "GET", path: "/v1/partners" },
    {
      name: "파트너 등록 API",
      method: "POST",
      path: "/v1/partners/register",
    },
  ]) {
    await page.getByRole("button", { name: "엔드포인트 등록" }).click()
    await expect(page).toHaveURL(/\/service-endpoints\/new$/)
    dialog = page.locator("main")
    await choose(page, dialog, "서비스", "파트너 API")
    await dialog.getByRole("textbox", { name: "이름" }).fill(endpoint.name)
    await choose(page, dialog, "메서드", endpoint.method)
    await dialog.getByRole("textbox", { name: "경로" }).fill(endpoint.path)
    await dialog.getByRole("button", { name: "다음" }).click()
    await dialog.getByRole("button", { name: "등록" }).click()
    await expect(page).toHaveURL(/\/service-endpoints\/[0-9a-f-]+$/)
    await page.getByRole("link", { name: "엔드포인트", exact: true }).click()
  }

  await page.getByRole("link", { name: "요청 템플릿" }).click()
  await page.getByRole("button", { name: "요청 템플릿 추가" }).click()
  await expect(page).toHaveURL(/\/approval-lines\/new$/)
  dialog = page.locator("main")
  await dialog
    .getByRole("textbox", { name: "템플릿 이름" })
    .fill("파트너 API Key 발급")
  await choose(page, dialog, "요청 분류", "자격 증명")
  await choose(page, dialog, "처리 유형", "API Key 발급 요청")
  await dialog.getByRole("button", { name: "단계 추가" }).click()
  await dialog.getByRole("button", { name: "단계 추가" }).click()
  await choose(page, dialog, "담당자 결정 방식", "요청 조직의 조직장", 1)

  const requestFields = [
    {
      key: "service",
      label: "발급 대상 서비스",
      binding: "대상 서비스",
    },
    {
      key: "request-organization",
      label: "요청 조직",
      binding: "요청 조직",
    },
    {
      key: "key-name",
      label: "자격증명 이름",
      binding: "Credential 이름",
    },
    {
      key: "aws-secret-name",
      label: "AWS ASM Secret name",
      binding: "AWS ASM Secret name",
    },
    {
      key: "aws-secret-key",
      label: "Secret value key",
      binding: "Secret value key",
    },
    {
      key: "reason",
      label: "발급 사유",
      binding: "요청 사유",
    },
  ]
  for (const [index, field] of requestFields.entries()) {
    await dialog.getByRole("button", { name: "입력 항목 추가" }).click()
    await dialog
      .getByRole("textbox", { name: "필드 키" })
      .nth(index)
      .fill(field.key)
    await dialog
      .getByRole("textbox", { name: "표시 이름" })
      .nth(index)
      .fill(field.label)
    await choose(page, dialog, "연결 값", field.binding, index)
  }
  await dialog.getByRole("button", { name: "다음" }).click()
  await expect(
    dialog.getByRole("heading", { name: "요청 템플릿 구성을 검토하세요" }),
  ).toBeVisible()
  await dialog.getByRole("button", { name: "템플릿 저장" }).click()
  await expect(page).toHaveURL(/\/approval-lines\/[0-9a-f-]+$/)
  await expect(
    page.getByRole("heading", { name: "결재 라인 구성" }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "입력 항목 구성" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "요청 템플릿 수정" }).click()
  await expect(page).toHaveURL(/\/approval-lines\/[0-9a-f-]+\/edit$/)
  dialog = page.locator("main")
  await dialog
    .getByRole("textbox", { name: "템플릿 이름" })
    .fill("파트너 자격증명 발급")
  await dialog.getByRole("button", { name: "다음" }).click()
  await dialog.getByRole("button", { name: "변경사항 저장" }).click()
  await expect(page).toHaveURL(/\/approval-lines\/[0-9a-f-]+$/)
  await expect(
    page.getByRole("heading", { name: "파트너 자격증명 발급" }),
  ).toBeVisible()

  await page.getByRole("link", { name: "서비스", exact: true }).click()
  await page
    .getByRole("row", { name: "파트너 API 상세 보기" })
    .getByRole("cell", { name: "파트너 API", exact: true })
    .click()
  await page.getByRole("button", { name: "서비스 수정" }).click()
  await expect(page).toHaveURL(/\/services\/[0-9a-f-]+\/edit$/)
  dialog = page.locator("main")
  await choose(page, dialog, "API Key 발급 요청 템플릿", "파트너 자격증명 발급")
  await dialog.getByRole("button", { name: "다음" }).click()
  await dialog.getByRole("button", { name: "저장" }).click()
  await expect(page).toHaveURL(/\/services\/[0-9a-f-]+$/)

  await page.getByRole("link", { name: "자격증명" }).click()
  await page.getByRole("button", { name: "자격증명 요청" }).click()
  await expect(page).toHaveURL(/\/credentials\/request$/)
  dialog = page.locator("main")
  await dialog
    .getByRole("radio", { name: /Partner Integration.*개발 1팀/ })
    .click()
  await dialog
    .getByRole("searchbox", { name: "요청 대상 서비스" })
    .fill("파트너 API")
  await dialog.getByRole("radio", { name: /파트너 API/ }).click()
  await dialog.getByRole("checkbox", { name: /GET \/v1\/partners/ }).check()
  await dialog.getByRole("checkbox", { name: /POST \/v1\/partners/ }).check()
  await expect(dialog.getByText("2개 선택")).toBeVisible()
  await dialog
    .getByRole("textbox", { name: "자격증명 이름" })
    .fill("partner-integration")
  await dialog
    .getByRole("textbox", { name: "AWS ASM Secret name" })
    .fill("backoffice/partner-api")
  await dialog
    .getByRole("textbox", { name: "Secret value key" })
    .fill("partner-integration")
  await expect(
    dialog.getByRole("combobox", { name: "요청 조직" }),
  ).toContainText("개발 1팀")
  await dialog
    .getByRole("textbox", { name: "발급 사유" })
    .fill("파트너 운영 시스템 연동을 위한 키가 필요합니다.")
  await dialog.getByRole("button", { name: "다음" }).click()
  await expect(
    dialog.getByRole("heading", { name: "자격증명 요청 내용을 검토하세요" }),
  ).toBeVisible()
  await expect(dialog.getByText("Jhonny", { exact: true })).toBeVisible()
  await expect(dialog.getByText("GET /v1/partners")).toBeVisible()
  await expect(dialog.getByText("POST /v1/partners/register")).toBeVisible()
  await dialog.getByRole("button", { name: "발급 요청 제출" }).click()
  await expect(page).toHaveURL(/\/approval-documents\/requests\/[0-9a-f-]+$/)
  await page.getByRole("link", { name: "자격증명", exact: true }).click()

  const requestRow = page
    .getByRole("row")
    .filter({ hasText: "partner-integration" })
    .filter({ hasText: "파트너 API" })
  await expect(requestRow).toContainText("승인 대기")
  await processRequestStages(page, requestRow, [
    { actor: "Jhonny", action: "승인" },
  ])
  const approvedRequestRow = page
    .getByRole("row")
    .filter({ hasText: "partner-integration" })
    .filter({ hasText: "파트너 API" })
  await expect(approvedRequestRow).toContainText("등록 대기")
  await approvedRequestRow
    .getByRole("button", { name: "자격증명 등록" })
    .click()
  dialog = page.getByRole("dialog", {
    name: "내부 서비스 자격증명 자동 등록",
  })
  await expect(dialog.getByLabel("API Key 원문")).toHaveCount(0)
  await dialog.getByRole("button", { name: "시스템 등록" }).click()
  await expect(dialog).toBeHidden()
  const issuedSecretDialog = page.getByRole("dialog", {
    name: "발급된 자격증명",
  })
  await expect(
    issuedSecretDialog.getByRole("textbox", { name: "자격증명 원문" }),
  ).toHaveValue(/^bok_[a-f0-9]{32}$/)
  await issuedSecretDialog.getByRole("button", { name: "확인" }).click()
  await expect(issuedSecretDialog).toBeHidden()

  const issuedKeyRow = page
    .getByRole("table", { name: "자격증명 목록" })
    .getByRole("row")
    .filter({ hasText: "partner-integration" })
  await expect(issuedKeyRow).toContainText("파트너 API")
  await expect(issuedKeyRow).toContainText("활성")
  await expect(issuedKeyRow).not.toContainText("bok_")

  await issuedKeyRow
    .getByRole("cell", { name: "partner-integration", exact: true })
    .click()
  await expect(page.getByRole("heading", { name: "요청 이력" })).toBeVisible()
  await expect(
    page
      .getByRole("table", { name: "자격 증명 요청 이력" })
      .getByRole("row")
      .filter({ hasText: "API Key 발급 요청" })
      .filter({ hasText: "자격증명 발급 요청: partner-integration" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "교체 요청" }).click()
  await expect(page).toHaveURL(/\/credentials\/[0-9a-f-]+\/replace$/)
  dialog = page.locator("main")
  await expect(dialog.getByText("partner-integration")).toBeVisible()
  await choose(page, dialog, "요청 조직", "개발 1팀")
  await dialog
    .getByRole("textbox", { name: "교체 사유" })
    .fill("정기 교체 주기에 따른 API Key 교체 요청입니다.")
  await dialog.getByRole("button", { name: "다음" }).click()
  await dialog.getByRole("button", { name: "요청 제출" }).click()
  await expect(page).toHaveURL(/\/approval-documents\/requests\/[0-9a-f-]+$/)
  await page.getByRole("link", { name: "자격증명", exact: true }).click()
  const replacementRequestRow = page
    .getByRole("row")
    .filter({ hasText: "API Key 교체 요청" })
    .filter({ hasText: "partner-integration" })
  await processRequestStages(page, replacementRequestRow, [
    { actor: "Jhonny", action: "승인" },
    { actor: "Owen", action: "합의" },
  ])
  const approvedReplacementRequestRow = page
    .getByRole("row")
    .filter({ hasText: "API Key 교체 요청" })
    .filter({ hasText: "partner-integration" })
  await approvedReplacementRequestRow
    .getByRole("button", { name: "자격증명 등록" })
    .click()
  dialog = page.getByRole("dialog", {
    name: "내부 서비스 자격증명 자동 등록",
  })
  await dialog.getByRole("button", { name: "시스템 등록" }).click()
  const replacementSecretDialog = page.getByRole("dialog", {
    name: "발급된 자격증명",
  })
  await replacementSecretDialog.getByRole("button", { name: "확인" }).click()

  const activeReplacementRow = page
    .getByRole("table", { name: "자격증명 목록" })
    .getByRole("row")
    .filter({ hasText: "partner-integration" })
    .filter({ has: page.getByRole("cell", { name: "활성", exact: true }) })
  await activeReplacementRow
    .getByRole("cell", { name: "partner-integration", exact: true })
    .click()
  await expect(page).toHaveURL(/\/credentials\/[0-9a-f-]+$/)
  const replacementDetailUrl = page.url()
  await page.getByRole("button", { name: "폐기 요청" }).click()
  await expect(page).toHaveURL(/\/credentials\/[0-9a-f-]+\/dispose$/)
  dialog = page.locator("main")
  await choose(page, dialog, "요청 조직", "개발 1팀")
  await dialog
    .getByRole("textbox", { name: "폐기 사유" })
    .fill("사용이 종료된 연동용 API Key 폐기 요청입니다.")
  await dialog.getByRole("button", { name: "다음" }).click()
  await dialog.getByRole("button", { name: "요청 제출" }).click()
  await expect(page).toHaveURL(/\/approval-documents\/requests\/[0-9a-f-]+$/)
  await page.getByRole("link", { name: "자격증명", exact: true }).click()
  const disposalRequestRow = page
    .getByRole("row")
    .filter({ hasText: "API Key 폐기 요청" })
    .filter({ hasText: "partner-integration" })
  await processRequestStages(page, disposalRequestRow, [
    { actor: "Jhonny", action: "승인" },
    { actor: "Owen", action: "합의" },
  ])
  const approvedDisposalRequestRow = page
    .getByRole("row")
    .filter({ hasText: "API Key 폐기 요청" })
    .filter({ hasText: "partner-integration" })
  await expect(approvedDisposalRequestRow).toContainText("폐기 완료")

  await page
    .getByRole("table", { name: "자격증명 목록" })
    .getByRole("row")
    .filter({ hasText: "partner-integration" })
    .first()
    .getByRole("cell", { name: "partner-integration", exact: true })
    .click()
  await expect(page).toHaveURL(replacementDetailUrl)
  await expect(
    page.getByText("API Key 교체 요청: partner-integration"),
  ).toBeVisible()
  await expect(
    page.getByText("API Key 폐기 요청: partner-integration"),
  ).toBeVisible()
  await expect(page.getByText("비활성", { exact: true })).toBeVisible()
})

test("registers an EXTERNAL API key through the manual owner flow", async ({
  page,
}) => {
  await page.goto("/credentials")
  await waitForHydration(page)
  await switchSessionUser(page, "Amelia")
  await page.getByRole("button", { name: "자격증명 요청" }).click()
  let dialog = page.locator("main")
  await dialog
    .getByRole("radio", { name: /Developer Console.*개발 2팀/ })
    .click()
  await dialog
    .getByRole("searchbox", { name: "요청 대상 서비스" })
    .fill("협업 SaaS")
  await dialog.getByRole("radio", { name: /협업 SaaS/ }).click()
  await expect(
    dialog.getByText(/외부 서비스는 엔드포인트 단위로 관리하지 않으며/),
  ).toBeVisible()
  await dialog
    .getByRole("textbox", { name: "자격증명 이름" })
    .fill("collaboration-e2e-key")
  await dialog
    .getByRole("textbox", { name: "AWS ASM Secret name" })
    .fill("backoffice/collaboration-saas")
  await dialog
    .getByRole("textbox", { name: "Secret value key" })
    .fill("collaboration-e2e-key")
  await expect(
    dialog.getByRole("combobox", { name: "요청 조직" }),
  ).toContainText("개발 2팀")
  await dialog
    .getByRole("textbox", { name: "발급 사유" })
    .fill("외부 협업 서비스 연동을 위한 API Key를 등록합니다.")
  await dialog.getByRole("button", { name: "다음" }).click()
  await expect(
    dialog.getByRole("heading", { name: "자격증명 요청 내용을 검토하세요" }),
  ).toBeVisible()
  await dialog.getByRole("button", { name: "발급 요청 제출" }).click()
  await expect(page).toHaveURL(/\/approval-documents\/requests\/[0-9a-f-]+$/)
  await expect(page.getByText("Groo 연동 기안", { exact: true })).toBeVisible()
  await expect(page.getByText(/^groo-[0-9a-f-]+$/)).toBeVisible()
  await expect(
    page.getByText("내부에서 처리하지 않으며 Groo 완료 hook을 기다립니다."),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "승인", exact: true }),
  ).toHaveCount(0)
  await page.getByRole("link", { name: "자격증명", exact: true }).click()

  const submittedRequestRow = page
    .getByRole("row")
    .filter({ hasText: "collaboration-e2e-key" })
    .filter({ hasText: "협업 SaaS" })
  await expect(submittedRequestRow).toContainText("승인 대기")

  await switchSessionUser(page, "Benjamin")
  const approvedRequestRow = page
    .getByRole("row")
    .filter({ hasText: "collaboration-ready-key" })
    .filter({ hasText: "협업 SaaS" })
  await approvedRequestRow
    .getByRole("button", { name: "자격증명 등록" })
    .click()

  dialog = page.getByRole("dialog", {
    name: "외부 서비스 자격증명 수동 등록",
  })
  await expect(dialog.getByText("IT보안팀")).toBeVisible()
  await expect(dialog.getByText("backoffice/collaboration-saas")).toBeVisible()
  await dialog.getByLabel("API Key 원문").fill("external-e2e-secret-value")
  await dialog.getByRole("button", { name: "수동 등록" }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByRole("dialog", { name: "발급된 자격증명" }),
  ).toHaveCount(0)

  const credentialRow = page
    .getByRole("table", { name: "자격증명 목록" })
    .getByRole("row")
    .filter({ hasText: "collaboration-ready-key" })
  await expect(credentialRow).toContainText("협업 SaaS")
  await expect(credentialRow).not.toContainText("external-e2e-secret-value")
})

test("manages organization hierarchy and multiple memberships", async ({
  page,
}) => {
  await page.goto("/users")
  await waitForHydration(page)
  await createUser(page, "leader", "leader@example.com")
  await createUser(page, "member", "member@example.com")
  const leaderRow = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: "leader", exact: true }),
  })
  await expect(leaderRow.getByRole("combobox")).toHaveCount(0)
  await expect(leaderRow.getByText("재직", { exact: true })).toBeVisible()

  await page.getByRole("link", { name: "조직" }).click()
  await createOrganization(page, "기술 본부", "leader")
  await createOrganization(page, "플랫폼 팀", "member", "기술 본부")

  await page
    .getByRole("row", { name: "기술 본부 상세 보기" })
    .getByRole("cell", { name: "기술 본부", exact: true })
    .click()
  const organizationDetail = page
    .getByRole("heading", { name: "조직 상세" })
    .locator("../..")
  await expect(
    organizationDetail.getByText("최상위 조직", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "플랫폼 팀", exact: true }),
  ).toBeVisible()

  await page.getByRole("button", { name: "사용자 추가" }).click()
  let dialog = page.getByRole("dialog")
  await dialog.getByRole("searchbox", { name: "닉네임 검색" }).fill("member")
  await dialog.getByRole("checkbox", { name: "member" }).click()
  await dialog.getByRole("button", { name: "사용자 추가" }).click()
  await expect(
    page
      .getByRole("table", { name: "소속 사용자" })
      .getByRole("link", { name: "member", exact: true }),
  ).toBeVisible()

  await page.getByRole("button", { name: "조직 수정" }).click()
  await expect(page).toHaveURL(/\/organizations\/[0-9a-f-]+\/edit$/)
  dialog = page.locator("main")
  await dialog.getByRole("textbox", { name: "조직명" }).fill("기술 플랫폼 본부")
  await dialog.getByRole("button", { name: "다음" }).click()
  await dialog.getByRole("button", { name: "저장" }).click()
  await expect(page).toHaveURL(/\/organizations\/[0-9a-f-]+$/)
  await expect(
    page.getByRole("heading", { name: "기술 플랫폼 본부" }),
  ).toBeVisible()
  await expect(page.getByRole("heading", { name: "부여된 역할" })).toBeVisible()
  await expect(page.getByText("부여된 역할이 없습니다.")).toBeVisible()

  await page.getByRole("link", { name: "요청 템플릿" }).click()
  await page.getByRole("button", { name: "요청 템플릿 추가" }).click()
  dialog = page.locator("main")
  await dialog
    .getByRole("textbox", { name: "템플릿 이름" })
    .fill("플랫폼 변경 요청")
  await choose(page, dialog, "요청 분류", "접근 정책")
  await choose(page, dialog, "처리 유형", "리소스 생성 요청")
  await dialog.getByRole("button", { name: "단계 추가" }).click()
  await choose(page, dialog, "담당자 결정 방식", "고정 조직")
  await choose(page, dialog, "담당 대상", "기술 플랫폼 본부")
  await dialog.getByRole("button", { name: "단계 추가" }).click()
  await choose(page, dialog, "담당자 결정 방식", "고정 사용자", 1)
  await choose(page, dialog, "담당 대상", "member", 1)
  await dialog.getByRole("button", { name: "다음" }).click()
  await expect(
    dialog.getByRole("heading", {
      name: "요청 템플릿 구성을 검토하세요",
    }),
  ).toBeVisible()
  await dialog.getByRole("button", { name: "템플릿 저장" }).click()
  await expect(
    page.getByRole("heading", { name: "플랫폼 변경 요청", exact: true }),
  ).toBeVisible()

  await page.getByRole("link", { name: "조직" }).click()
  await page
    .getByRole("row", { name: "기술 플랫폼 본부 상세 보기" })
    .getByRole("cell", { name: "기술 플랫폼 본부", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "포함된 요청 템플릿" }),
  ).toHaveCount(0)

  await page
    .getByRole("table", { name: "소속 사용자" })
    .getByRole("link", { name: "member", exact: true })
    .click()
  await expect(
    page.getByRole("link", { name: "기술 플랫폼 본부", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "플랫폼 팀", exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("heading", { name: "부여된 역할" })).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Backoffice 일반 사용자", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "요청 템플릿 참여" }),
  ).toHaveCount(0)
})

test("adds multiple unassigned users from paginated nickname results", async ({
  page,
}) => {
  await page.goto("/users")
  await waitForHydration(page)
  await createUser(page, "page-leader", "page-leader@example.com")
  for (let index = 1; index <= 6; index += 1) {
    const suffix = String(index)
    await createUser(
      page,
      `page-member-${suffix}`,
      `page-member-${suffix}@example.com`,
    )
  }

  await page.getByRole("link", { name: "조직" }).click()
  await createOrganization(page, "페이지 조직", "page-leader")
  await page
    .getByRole("row", { name: "페이지 조직 상세 보기" })
    .getByRole("cell", { name: "페이지 조직", exact: true })
    .click()

  await page.getByRole("button", { name: "사용자 추가" }).click()
  let dialog = page.getByRole("dialog")
  await expect(
    dialog.getByRole("checkbox", { name: "page-leader" }),
  ).toHaveCount(0)
  await dialog
    .getByRole("searchbox", { name: "닉네임 검색" })
    .fill("page-member")
  await expect(dialog.getByText("1 / 2 페이지", { exact: true })).toBeVisible()
  await dialog.getByRole("checkbox", { name: "page-member-1" }).click()
  await dialog.getByRole("button", { name: "다음" }).click()
  await expect(dialog.getByText("2 / 2 페이지", { exact: true })).toBeVisible()
  await dialog.getByRole("checkbox", { name: "page-member-6" }).click()
  await dialog.getByRole("button", { name: "사용자 추가" }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByRole("link", { name: "page-member-1", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "page-member-6", exact: true }),
  ).toBeVisible()

  await page.getByRole("button", { name: "사용자 추가" }).click()
  dialog = page.getByRole("dialog")
  await dialog
    .getByRole("searchbox", { name: "닉네임 검색" })
    .fill("page-member-1")
  await expect(dialog.getByText("조건에 맞는 항목이 없습니다.")).toBeVisible()
})

test("assigns users, organizations, and roles from each detail page", async ({
  page,
}) => {
  await page.goto("/users")
  await waitForHydration(page)
  await createUser(page, "access-leader", "access-leader@example.com")
  await createUser(page, "access-member", "access-member@example.com")

  await page.getByRole("link", { name: "조직" }).click()
  await createOrganization(page, "접근 제어팀", "access-leader")

  await page.getByRole("link", { name: "역할" }).click()
  const rolesToCreate: { name: string; description: string }[] = [
    { name: "접근 관리자", description: "접근 권한을 관리합니다." },
    { name: "접근 검토자", description: "접근 권한을 검토합니다." },
  ]
  for (const role of rolesToCreate) {
    await createRole(page, role.name, role.description)
  }
  await page
    .getByRole("row", { name: "접근 관리자 상세 보기" })
    .getByRole("cell", { name: "접근 관리자", exact: true })
    .click()

  await expect(
    page.getByRole("heading", { name: "접근 관리자", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "사용자 추가" }).click()
  let dialog = page.getByRole("dialog")
  await dialog
    .getByRole("searchbox", { name: "닉네임 검색" })
    .fill("access-member")
  await dialog.getByRole("checkbox", { name: "access-member" }).click()
  await dialog.getByRole("button", { name: "사용자 추가" }).click()
  await expect(
    page.getByRole("cell", { name: "access-member", exact: true }),
  ).toBeVisible()

  await page.getByRole("button", { name: "조직 추가" }).click()
  dialog = page.getByRole("dialog")
  await dialog.getByRole("searchbox", { name: "조직명 검색" }).fill("접근 제어")
  await dialog.getByRole("checkbox", { name: "접근 제어팀" }).click()
  await dialog.getByRole("button", { name: "조직 추가" }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByRole("cell", { name: "접근 제어팀", exact: true }),
  ).toBeVisible()

  await page.getByRole("link", { name: "access-member", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "access-member", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "조직 추가" }).click()
  dialog = page.getByRole("dialog")
  await dialog.getByRole("searchbox", { name: "조직명 검색" }).fill("접근 제어")
  await dialog.getByRole("checkbox", { name: "접근 제어팀" }).click()
  await dialog.getByRole("button", { name: "조직 추가" }).click()
  await expect(
    page.getByRole("link", { name: "접근 제어팀", exact: true }),
  ).toBeVisible()

  await page.getByRole("button", { name: "역할 추가" }).click()
  dialog = page.getByRole("dialog")
  await dialog
    .getByRole("searchbox", { name: "역할 이름 또는 설명 검색" })
    .fill("검토")
  await dialog.getByRole("checkbox", { name: "접근 검토자" }).click()
  await dialog.getByRole("button", { name: "역할 추가" }).click()
  await expect(
    page.getByRole("link", { name: "접근 검토자", exact: true }),
  ).toBeVisible()

  await page.getByRole("link", { name: "접근 제어팀", exact: true }).click()
  await expect(
    page.getByRole("link", { name: "access-member", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "접근 관리자", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "역할 추가" }).click()
  dialog = page.getByRole("dialog")
  await dialog
    .getByRole("searchbox", { name: "역할 이름 또는 설명 검색" })
    .fill("접근 검토")
  await dialog.getByRole("checkbox", { name: "접근 검토자" }).click()
  await dialog.getByRole("button", { name: "역할 추가" }).click()
  await expect(
    page.getByRole("link", { name: "접근 검토자", exact: true }),
  ).toBeVisible()
})

test("removes the unused menu management route from navigation", async ({
  page,
}) => {
  await page.goto("/")
  await waitForHydration(page)
  await expect(
    page.locator("aside").getByRole("link", { name: "메뉴", exact: true }),
  ).toHaveCount(0)

  await page.goto("/menus")
  await expect(
    page.getByRole("heading", { name: "페이지를 찾을 수 없습니다" }),
  ).toBeVisible()
})

test("shows the complete request list only with its UI resource access", async ({
  page,
}) => {
  await page.goto("/requests")
  await waitForHydration(page)

  const requestTable = page.getByRole("table", { name: "전체 요청 목록" })
  await expect(requestTable).toBeVisible()
  await expect(
    requestTable.getByText("접근 정책", { exact: true }),
  ).toBeVisible()
  await expect(requestTable.getByText("자격증명", { exact: true })).toHaveCount(
    3,
  )
  await expect(
    requestTable.getByText("협업 SaaS 자격증명 등록 재시도 예시"),
  ).toBeVisible()
  await requestTable
    .getByRole("row", { name: /로컬 API Key 발급 요청/ })
    .getByRole("cell", { name: "로컬 API Key 발급 요청", exact: true })
    .click()
  await expect(page.getByText("Groo 연동 기안", { exact: true })).toBeVisible()
  await expect(page.getByText("GROO-REQUEST-20260808-0001")).toBeVisible()
  await expect(
    page.getByText("Groo의 최종 결재 결과가 이 요청에 반영되었습니다."),
  ).toBeVisible()
  for (const action of ["승인", "반려", "요청 회수", "재상신"]) {
    await expect(
      page.getByRole("button", { name: action, exact: true }),
    ).toHaveCount(0)
  }

  await page.goto("/requests")
  await waitForHydration(page)

  await switchSessionUser(page, "Daniel")
  await expect(
    page.getByRole("heading", { name: "접근 권한이 없습니다" }),
  ).toBeVisible()
  await expect(
    page.locator("#app-sidebar").getByRole("link", {
      name: "요청",
      exact: true,
    }),
  ).toHaveCount(0)
})

test("credential request page passes accessibility checks at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto("/credentials")
  await waitForHydration(page)
  await page.getByRole("button", { name: "자격증명 요청" }).click()
  const dialog = page.locator("main")
  await expect(dialog).toBeVisible()
  await dialog.evaluate(async (element) => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
    await Promise.allSettled(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    )
  })
  const documentWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  )
  expect(documentWidth).toBeLessThanOrEqual(320)
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze()
  expect(
    results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([])
})
