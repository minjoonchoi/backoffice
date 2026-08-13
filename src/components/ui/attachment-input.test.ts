import { describe, expect, it } from "vitest"

import { validateAttachmentFiles } from "@/components/ui/attachment-input"

describe("validateAttachmentFiles", () => {
  const pdf = new File(["report"], "report.pdf", {
    type: "application/pdf",
  })
  const image = new File(["image"], "photo.png", { type: "image/png" })

  it("accepts matching MIME types, wildcards, and extensions", () => {
    expect(
      validateAttachmentFiles([pdf, image], {
        accept: ".pdf,image/*",
        maxFiles: 2,
      }),
    ).toEqual({ files: [pdf, image], errors: [] })
  })

  it("rejects the full selection when a file is invalid", () => {
    const result = validateAttachmentFiles([pdf, image], {
      accept: "application/pdf",
      maxFiles: 2,
    })

    expect(result.files).toEqual([])
    expect(result.errors).toEqual([
      {
        code: "file-type-not-accepted",
        file: image,
        accept: "application/pdf",
      },
    ])
  })

  it("reports file count and size boundaries", () => {
    const result = validateAttachmentFiles([pdf, image], {
      maxFiles: 1,
      maxSize: 4,
    })

    expect(result.files).toEqual([])
    expect(result.errors.map((error) => error.code)).toEqual([
      "too-many-files",
      "file-too-large",
      "file-too-large",
    ])
  })

  it("rejects invalid validation options", () => {
    expect(() => validateAttachmentFiles([], { maxFiles: 0 })).toThrow(
      RangeError,
    )
    expect(() => validateAttachmentFiles([], { maxSize: 0 })).toThrow(
      RangeError,
    )
  })
})
