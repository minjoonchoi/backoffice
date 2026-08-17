import { describe, expect, it } from "vitest"

import { completeGrooApprovalDocument } from "@/features/access-policies/groo-approval-hook"
import type { ApprovalDocument } from "@/features/access-policies/model"
import { localFixture } from "@/mocks/fixture"

type GrooApprovalDocument = ApprovalDocument & {
  approvalExecution: Extract<
    ApprovalDocument["approvalExecution"],
    { type: "groo" }
  >
}

function grooRequest(): GrooApprovalDocument {
  const document = localFixture.approvalDocuments.find(
    (candidate) => candidate.approvalExecution.type === "groo",
  )
  if (document?.approvalExecution.type !== "groo") {
    throw new Error("Groo request fixture is missing")
  }
  return {
    ...document,
    approvalExecution: document.approvalExecution,
    status: "submitted" as const,
    history: document.history.slice(0, 1),
  }
}

describe("Groo approval completion hook", () => {
  it("completes the mapped request without internal approval steps", () => {
    const document = grooRequest()
    const completedAt = "2026-08-18T01:00:00.000Z"
    const result = completeGrooApprovalDocument(document, {
      requestId: document.approvalExecution.requestId,
      result: "approved",
      completedAt,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.changed).toBe(true)
    expect(result.value.document).toMatchObject({
      status: "approved",
      approvalSteps: [],
    })
    expect(result.value.document.history.at(-1)).toMatchObject({
      type: "approved",
      actorUserId: null,
      stepId: null,
      createdAt: completedAt,
    })
  })

  it("is idempotent for the same terminal result and rejects conflicts", () => {
    const document = grooRequest()
    const approved = completeGrooApprovalDocument(document, {
      requestId: document.approvalExecution.requestId,
      result: "approved",
      completedAt: "2026-08-18T01:00:00.000Z",
    })
    if (!approved.ok) throw new Error("Groo completion failed")

    const duplicate = completeGrooApprovalDocument(approved.value.document, {
      requestId: document.approvalExecution.requestId,
      result: "approved",
      completedAt: "2026-08-18T01:01:00.000Z",
    })
    expect(duplicate).toMatchObject({ ok: true, value: { changed: false } })

    expect(
      completeGrooApprovalDocument(approved.value.document, {
        requestId: document.approvalExecution.requestId,
        result: "rejected",
        completedAt: "2026-08-18T01:02:00.000Z",
      }),
    ).toEqual({
      ok: false,
      error: "approval-document-transition-invalid",
    })
  })

  it("rejects an unknown Groo request ID", () => {
    expect(
      completeGrooApprovalDocument(grooRequest(), {
        requestId: "GROO-UNKNOWN",
        result: "approved",
        completedAt: "2026-08-18T01:00:00.000Z",
      }),
    ).toEqual({ ok: false, error: "approval-document-not-found" })
  })
})
