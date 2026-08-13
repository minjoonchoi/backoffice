import { expect, test } from "@playwright/test"

const storybookBaseUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_STORYBOOK_PORT ?? "6006"}`

test("select supports keyboard selection and returns focus", async ({
  page,
}) => {
  await page.goto(
    `${storybookBaseUrl}/iframe.html?id=components-form-controls--select-keyboard-fixture&viewMode=story`,
  )

  const trigger = page.getByRole("combobox", { name: "Account state" })
  await trigger.focus()
  await page.keyboard.press("Enter")

  const listbox = page.getByRole("listbox")
  await expect(listbox).toBeVisible()
  await expect(
    page.getByRole("option", { name: "Pending review" }),
  ).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")

  await expect(trigger).toContainText("Approved")
  await expect(listbox).toBeHidden()
  await expect(trigger).toBeFocused()
})

test("dialog traps focus, closes with Escape, and restores focus", async ({
  page,
}) => {
  await page.goto(
    `${storybookBaseUrl}/iframe.html?id=components-overlays--dialog-keyboard-fixture&viewMode=story`,
  )

  const trigger = page.getByRole("button", { name: "Open dialog" })
  await trigger.focus()
  await page.keyboard.press("Enter")

  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect
    .poll(() =>
      dialog.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true)

  await page.keyboard.press("Tab")
  await expect
    .poll(() =>
      dialog.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true)

  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test("side panel traps focus, closes with Escape, and restores focus", async ({
  page,
}) => {
  await page.goto(
    `${storybookBaseUrl}/iframe.html?id=components-side-panel--side-panel-keyboard-fixture&viewMode=story`,
  )

  const trigger = page.getByRole("button", { name: "작업 상세 열기" })
  await trigger.focus()
  await page.keyboard.press("Enter")

  const panel = page.getByRole("dialog")
  await expect(panel).toBeVisible()
  await expect
    .poll(() =>
      panel.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true)

  await page.keyboard.press("Tab")
  await expect
    .poll(() =>
      panel.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true)

  await page.keyboard.press("Escape")
  await expect(panel).toBeHidden()
  await expect(trigger).toBeFocused()
})

test("form composition remains stable at 320px in Korean and English", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 })

  for (const locale of ["ko", "en"] as const) {
    await page.goto(
      `${storybookBaseUrl}/iframe.html?id=components-form-controls--responsive-form-composition&viewMode=story&globals=locale:${locale}`,
    )

    await expect(page.getByRole("heading", { level: 2 })).toBeVisible()
    const hasHorizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
    expect(hasHorizontalOverflow).toBe(false)

    const select = page.getByRole("combobox")
    await select.click()
    const listbox = page.getByRole("listbox")
    await expect(listbox).toBeVisible()
    const box = await listbox.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(320)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.y + box.height).toBeLessThanOrEqual(568)
    }
    await page.keyboard.press("Escape")
  }
})

test("long dialog stays inside a mobile viewport and scrolls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto(
    `${storybookBaseUrl}/iframe.html?id=components-overlays--dialog-overflow&viewMode=story`,
  )

  await page.getByRole("button", { name: "Open long dialog" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  const box = await dialog.boundingBox()
  expect(box).not.toBeNull()
  if (box) {
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(320)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(568)
  }

  const isScrollable = await dialog.evaluate(
    (element) => element.scrollHeight > element.clientHeight,
  )
  expect(isScrollable).toBe(true)
})
