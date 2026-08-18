import { defineConfig, devices } from "@playwright/test"

function resolvePort(name: string, fallback: number) {
  const value = process.env[name]
  if (value === undefined) return fallback
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a numeric TCP port.`)
  }
  const port = Number(value)
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65_535) {
    throw new Error(`${name} must be between 1024 and 65535.`)
  }
  return port
}

const allowPort = resolvePort("PLAYWRIGHT_ALLOW_PORT", 3000)
const blockedPort = resolvePort("PLAYWRIGHT_BLOCKED_PORT", 3001)
const storybookPort = resolvePort("PLAYWRIGHT_STORYBOOK_PORT", 6006)
const allowPortString = String(allowPort)
const blockedPortString = String(blockedPort)
const storybookPortString = String(storybookPort)
const allowBaseUrl = `http://localhost:${allowPortString}`
const blockedBaseUrl = `http://127.0.0.1:${blockedPortString}`
const storybookBaseUrl = `http://127.0.0.1:${storybookPortString}`

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: allowBaseUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: [
    {
      command: `NEXT_E2E=1 HOSTNAME=127.0.0.1 PORT=${allowPortString} pnpm dev:mock`,
      url: `${allowBaseUrl}/api/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `HOSTNAME=127.0.0.1 PORT=${blockedPortString} pnpm start`,
      url: `${blockedBaseUrl}/api/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `pnpm exec http-server storybook-static --address 127.0.0.1 --port ${storybookPortString} --silent`,
      url: storybookBaseUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
