import { describe, expect, it } from "vitest"

import {
  previewRequestTemplate,
  resolveRequestTemplateImpact,
} from "@/features/request-templates/request-template-analysis"
import { localFixture } from "@/mocks/fixture"

describe("request template analysis", () => {
  it("resolves dynamic approvers and linked service impact", () => {
    const template = localFixture.approvalLines.find(
      (line) => line.type === "api-key",
    )
    const requester = localFixture.users.find(
      (user) => user.nickname === "David",
    )
    const requestOrganization = localFixture.organizations.find(
      (organization) => organization.name === "개발 1팀",
    )
    const upperLeader = localFixture.users.find(
      (user) => user.nickname === "Jhonny",
    )
    const service = localFixture.services.find(
      (candidate) => candidate.type === "internal",
    )
    if (
      !template ||
      !requester ||
      !requestOrganization ||
      !upperLeader ||
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
      assigneeId: upperLeader.id,
    })
    expect(
      preview.some(
        (step) =>
          step.assigneeType === "organization" &&
          step.assigneeId === service.ownerOrganizationId,
      ),
    ).toBe(true)
    expect(
      resolveRequestTemplateImpact(localFixture, template).serviceIds,
    ).toContain(service.id)
  })
})
