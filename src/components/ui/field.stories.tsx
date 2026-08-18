import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldHeader,
  FieldLabel,
  FieldMeta,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const meta = {
  title: "Components/Field",
} satisfies Meta

export default meta
type Story = StoryObj

export const Anatomy: Story = {
  render: () => (
    <div className="grid max-w-md gap-6">
      <Field>
        <FieldHeader>
          <FieldLabel htmlFor="field-operator-id">운영자 ID</FieldLabel>
          <FieldMeta>필수</FieldMeta>
        </FieldHeader>
        <Input
          id="field-operator-id"
          aria-describedby="field-operator-id-description"
          placeholder="operator-123"
        />
        <FieldDescription id="field-operator-id-description">
          영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.
        </FieldDescription>
      </Field>

      <Field invalid>
        <FieldHeader>
          <FieldLabel htmlFor="field-note">반려 사유</FieldLabel>
          <FieldMeta>3 / 20</FieldMeta>
        </FieldHeader>
        <Textarea
          id="field-note"
          defaultValue="짧음"
          aria-invalid="true"
          aria-describedby="field-note-error"
        />
        <FieldError id="field-note-error">
          반려 사유를 20자 이상 입력하세요.
        </FieldError>
      </Field>

      <Field disabled>
        <FieldHeader>
          <FieldLabel htmlFor="field-owner">담당 조직</FieldLabel>
          <FieldMeta>자동 지정</FieldMeta>
        </FieldHeader>
        <Input id="field-owner" value="운영 정책팀" disabled readOnly />
      </Field>
    </div>
  ),
}
