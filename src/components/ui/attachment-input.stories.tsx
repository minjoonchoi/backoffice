import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState } from "react"
import { expect, userEvent, within } from "storybook/test"

import {
  AttachmentInput,
  AttachmentItem,
  AttachmentList,
  type AttachmentValidationResult,
} from "@/components/ui/attachment-input"

const meta = {
  title: "Components/Attachment Input",
} satisfies Meta

export default meta
type Story = StoryObj

function AttachmentFixture() {
  const [result, setResult] = useState<AttachmentValidationResult>({
    files: [],
    errors: [],
  })
  const firstError = result.errors[0]

  return (
    <div className="grid max-w-lg gap-3">
      <AttachmentInput
        accept=".csv,application/pdf"
        maxFiles={2}
        maxSize={1024 * 1024}
        multiple
        onFilesChange={setResult}
      >
        파일 선택
      </AttachmentInput>
      {result.files.length > 0 ? (
        <AttachmentList aria-label="선택한 파일">
          {result.files.map((file) => (
            <AttachmentItem
              key={`${file.name}-${String(file.lastModified)}`}
              fileName={file.name}
              description={`${String(file.size)} bytes`}
              removeAction={{
                label: `${file.name} 제거`,
                onClick: () => {
                  setResult({ files: [], errors: [] })
                },
              }}
            />
          ))}
        </AttachmentList>
      ) : null}
      {firstError ? (
        <p role="alert" className="text-body text-destructive-foreground">
          {firstError.code === "too-many-files"
            ? `파일은 최대 ${String(firstError.maxFiles)}개까지 선택할 수 있습니다.`
            : firstError.code === "file-too-large"
              ? `${firstError.file.name}의 크기가 제한을 초과했습니다.`
              : `${firstError.file.name}은 허용되지 않는 형식입니다.`}
        </p>
      ) : null}
    </div>
  )
}

export const ValidationInteraction: Story = {
  render: () => <AttachmentFixture />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByLabelText("파일 선택")
    const csv = new File(["id,name\n1,Alex"], "operators.csv", {
      type: "text/csv",
    })
    await userEvent.upload(input, csv)
    await expect(canvas.getByText("operators.csv")).toBeVisible()

    const oversized = new File(
      [new Uint8Array(1024 * 1024 + 1)],
      "oversized.csv",
      {
        type: "text/csv",
      },
    )
    await userEvent.upload(input, oversized)
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "크기가 제한을 초과",
    )
    await expect(
      canvas.queryByText("oversized.csv", { selector: "li *" }),
    ).toBeNull()
  },
}

export const UploadStates: Story = {
  render: () => (
    <AttachmentList className="max-w-lg" aria-label="첨부 파일 상태">
      <AttachmentItem fileName="policy.pdf" description="420 KB" />
      <AttachmentItem
        fileName="operators.csv"
        description="업로드 중 64%"
        state="uploading"
        progress={64}
        removeAction={{ label: "operators.csv 제거", onClick: () => undefined }}
      />
      <AttachmentItem
        fileName="settlement.xlsx"
        description="네트워크 연결을 확인하세요."
        state="error"
        retryAction={{
          label: "settlement.xlsx 다시 시도",
          onClick: () => undefined,
        }}
        removeAction={{
          label: "settlement.xlsx 제거",
          onClick: () => undefined,
        }}
      />
      <AttachmentItem
        fileName="archived.pdf"
        description="사용할 수 없음"
        state="disabled"
        removeAction={{ label: "archived.pdf 제거", onClick: () => undefined }}
      />
    </AttachmentList>
  ),
}
