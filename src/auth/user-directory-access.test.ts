import { describe, expect, it } from "vitest"

import { resolveVisibleDirectoryUsers } from "@/auth/user-directory-access"
import { localFixture } from "@/mocks/fixture"

describe("user directory access", () => {
  it("hides resigned users from a general user", () => {
    expect(
      resolveVisibleDirectoryUsers(localFixture.users, false),
    ).not.toContainEqual(expect.objectContaining({ nickname: "Olivia" }))
  })

  it("keeps resigned users visible with directory access", () => {
    expect(
      resolveVisibleDirectoryUsers(localFixture.users, true),
    ).toContainEqual(expect.objectContaining({ nickname: "Olivia" }))
  })
})
