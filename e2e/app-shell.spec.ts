import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

async function waitForHydration(page: Page) {
  await expect(page.locator("[data-app-shell]")).toHaveAttribute(
    "data-hydrated",
    "true",
    { timeout: 15_000 },
  )
}

test("renders the localized shell and exposes keyboard navigation", async ({
  browserName,
  page,
}) => {
  await page.goto("/")
  await waitForHydration(page)

  await expect(page.locator("html")).toHaveAttribute("lang", "ko")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("업무 홈")
  await expect(page.getByRole("heading", { name: "정책" })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "홈" })).toBeVisible()
  await expect(page.getByRole("link", { name: "정책" })).toBeVisible()
  await expect(page.getByRole("link", { name: "자격증명" })).toBeVisible()

  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab")
  const skipLink = page.getByRole("link", { name: "본문으로 건너뛰기" })
  await expect(skipLink).toBeFocused()
  await expect(skipLink).toBeVisible()
})

test("collapses the desktop sidebar and operates the user menu by keyboard", async ({
  page,
}) => {
  await page.goto("/")
  await waitForHydration(page)

  const sidebar = page.locator("#app-sidebar")
  const toggle = page
    .locator("header")
    .getByRole("button", { name: "사이드바 전환" })
  await expect(toggle).toHaveAttribute("aria-expanded", "true")
  await toggle.click()
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
  await expect(sidebar).toHaveCSS("width", "72px")
  await expect(sidebar.getByRole("link", { name: "자격증명" })).toBeVisible()

  await toggle.click()
  await expect(sidebar).toHaveCSS("width", "256px")
  const resizeHandle = sidebar.getByRole("separator", {
    name: "사이드바 너비 조절",
  })
  const handleBox = await resizeHandle.boundingBox()
  expect(handleBox).not.toBeNull()
  if (handleBox) {
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 40)
    await page.mouse.down()
    await page.mouse.move(500, handleBox.y + 40)
    await page.mouse.up()
  }
  await expect(sidebar).toHaveCSS("width", "320px")
  await resizeHandle.focus()
  await page.keyboard.press("Home")
  await expect(sidebar).toHaveCSS("width", "72px")
  await page.keyboard.press("End")
  await expect(sidebar).toHaveCSS("width", "320px")

  const userMenu = page.getByRole("button", { name: "사용자 메뉴" })
  await userMenu.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByText("로컬 mock 로그인")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(userMenu).toBeFocused()
})

test("persists locale in a cookie without changing the URL", async ({
  context,
  page,
}) => {
  await page.goto("/")
  await waitForHydration(page)
  const initialUrl = new URL(page.url())

  await page.getByRole("combobox", { name: "언어" }).selectOption("en")
  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Work home")
  expect(new URL(page.url()).pathname).toBe(initialUrl.pathname)

  await page.reload()
  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  const localeCookie = (await context.cookies()).find(
    (cookie) => cookie.name === "NEXT_LOCALE",
  )
  expect(localeCookie?.value).toBe("en")
  expect(localeCookie?.httpOnly).toBe(true)
})

test("renders the localized not-found page", async ({ page }) => {
  const response = await page.goto("/missing-foundation-route")

  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole("heading", { name: "페이지를 찾을 수 없습니다" }),
  ).toBeVisible()
})

test("has no serious or critical accessibility violations", async ({
  page,
}) => {
  await page.goto("/")
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze()
  const materialViolations = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  )

  expect(materialViolations).toEqual([])
})
