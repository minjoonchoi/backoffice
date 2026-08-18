import { describe, expect, it } from "vitest"

import {
  previewRequestTemplate,
  resolveRequestTemplateImpact,
} from "@/features/request-templates/request-template-analysis"
import { localFixture } from "@/mocks/fixture"

describe("request template analysis", () => {
  it("resolves assignees for an internal template", () => {
    const template = localFixture.approvalLines.find(
      (line) => line.type === "access-grant",
    )
    const requester = localFixture.users.find(
      (user) => user.nickname === "David",
    )
    const requestOrganization = localFixture.organizations.find(
      (organization) => organization.name === "개발 1팀",
    )
    const fixedApprover = localFixture.users.find(
      (user) => user.nickname === "Ethan",
    )
    const service = localFixture.services.find(
      (candidate) => candidate.type === "internal",
    )
    if (
      !template ||
      !requester ||
      !requestOrganization ||
      !fixedApprover ||
      !service
    ) {
      throw new Error("Request template preview fixture is missing")
    }

    const preview = previewRequestTemplate(localFixture, template, {
      requesterId: requester.id,
      requestOrganizationId: requestOrganization.id,
      serviceId: service.id,
    })

    expect(preview[0]).toMatchObject({
      kind: "request",
      assigneeType: "user",
      assigneeId: requester.id,
    })
    expect(preview[1]).toMatchObject({
      kind: "approval",
      assigneeType: "user",
      assigneeId: fixedApprover.id,
    })
    expect(
      resolveRequestTemplateImpact(localFixture, template).serviceIds,
    ).toEqual([])
  })

  it("keeps Groo workflow stages outside the backoffice", () => {
    const template = localFixture.approvalLines.find(
      (line) => line.type === "api-key",
    )
    const requester = localFixture.users.find(
      (user) => user.nickname === "David",
    )
    const requestOrganization = localFixture.organizations.find(
      (organization) => organization.name === "개발 1팀",
    )
    const service = localFixture.services.find(
      (candidate) => candidate.type === "internal",
    )
    if (!template || !requester || !requestOrganization || !service) {
      throw new Error("Groo request template fixture is missing")
    }

    expect(
      previewRequestTemplate(localFixture, template, {
        requesterId: requester.id,
        requestOrganizationId: requestOrganization.id,
        serviceId: service.id,
      }),
    ).toEqual([])
  })
})
