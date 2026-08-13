import { describe, expect, it } from "vitest"

import { cn } from "@/lib/utils"

describe("cn", () => {
  it("combines conditions and resolves conflicting Tailwind utilities", () => {
    expect(cn("px-2", { hidden: false }, "px-4")).toBe("px-4")
  })
})
