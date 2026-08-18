import process from "node:process"

import { stringify } from "yaml"

import { uiResourceManifest } from "../src/config/menu-registry.ts"

function readFormat(arguments_) {
  if (arguments_.length === 0) return "yaml"
  if (arguments_.length === 1 && arguments_[0]?.startsWith("--format=")) {
    return arguments_[0].slice("--format=".length)
  }
  if (arguments_.length === 2 && arguments_[0] === "--format") {
    return arguments_[1]
  }
  throw new Error("Usage: pnpm uiResources:export --format <yaml|json>")
}

const format = readFormat(process.argv.slice(2))
if (format !== "yaml" && format !== "json") {
  throw new Error(`Unsupported UI Resource manifest format: ${format}`)
}

const output =
  format === "json"
    ? `${JSON.stringify(uiResourceManifest, null, 2)}\n`
    : stringify(uiResourceManifest, { lineWidth: 0 })

process.stdout.write(output)
