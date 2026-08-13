import { expect, test } from "@playwright/test"

const storybookBaseUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_STORYBOOK_PORT ?? "6006"}`

test("traps and restores focus in the confirmation dialog", async ({
  page,
}) => {
  await page.goto(
    `${storybookBaseUrl}/iframe.html?id=patterns-foundation--confirm-keyboard&viewMode=story`,
  )

  const trigger = page.getByRole("button", { name: "Open confirmation" })
  await trigger.focus()
  await page.keyboard.press("Enter")

  const dialog = page.getByRole("alertdialog")
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
