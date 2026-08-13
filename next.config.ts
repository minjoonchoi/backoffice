import createNextIntlPlugin from "next-intl/plugin"
import type { NextConfig } from "next"
import { fileURLToPath } from "node:url"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")
const rawTextLoader = fileURLToPath(
  new URL("./scripts/raw-text-loader.cjs", import.meta.url),
)

const e2eMode = process.env.NEXT_E2E
if (e2eMode !== undefined && e2eMode !== "1") {
  throw new Error("NEXT_E2E must be 1 when it is defined.")
}

const nextConfig: NextConfig = {
  distDir: e2eMode === "1" ? ".next-e2e" : ".next",
  output: "standalone",
  poweredByHeader: false,
  reactCompiler: false,
  experimental: {
    authInterrupts: true,
  },
  turbopack: {
    rules: {
      "*.yaml": {
        loaders: [rawTextLoader],
        as: "*.js",
      },
    },
  },
}

export default withNextIntl(nextConfig)
