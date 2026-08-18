import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useLocale } from "next-intl"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

const meta = {
  title: "Components/Form Controls",
} satisfies Meta

export default meta
type Story = StoryObj

function LabeledCheckbox({
  id,
  label,
  ...props
}: { id: string; label: string } & React.ComponentProps<typeof Checkbox>) {
  return (
    <div className="flex min-h-8 items-center gap-2">
      <Checkbox id={id} {...props} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  )
}

function LabeledSwitch({
  id,
  label,
  ...props
}: { id: string; label: string } & React.ComponentProps<typeof Switch>) {
  return (
    <div className="flex min-h-8 items-center gap-2">
      <Switch id={id} {...props} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  )
}

export const States: Story = {
  render: () => (
    <div className="grid max-w-4xl gap-8 lg:grid-cols-2">
      <fieldset className="grid content-start gap-2">
        <legend className="mb-2 font-semibold">Checkbox</legend>
        <LabeledCheckbox id="checkbox-default" label="Default" />
        <LabeledCheckbox id="checkbox-checked" label="Checked" defaultChecked />
        <LabeledCheckbox
          id="checkbox-indeterminate"
          label="Indeterminate"
          indeterminate
        />
        <LabeledCheckbox id="checkbox-readonly" label="Read-only" readOnly />
        <LabeledCheckbox id="checkbox-disabled" label="Disabled" disabled />
        <LabeledCheckbox
          id="checkbox-invalid"
          label="Invalid"
          aria-invalid="true"
        />
      </fieldset>

      <fieldset className="grid content-start gap-2">
        <legend className="mb-2 font-semibold">Switch</legend>
        <LabeledSwitch id="switch-default" label="Off" />
        <LabeledSwitch id="switch-checked" label="On" defaultChecked />
        <LabeledSwitch id="switch-readonly" label="Read-only" readOnly />
        <LabeledSwitch id="switch-disabled" label="Disabled" disabled />
        <LabeledSwitch
          id="switch-invalid"
          label="Invalid"
          aria-invalid="true"
        />
      </fieldset>

      <fieldset className="grid content-start gap-3">
        <legend className="mb-1 font-semibold">RadioGroup</legend>
        <RadioGroup defaultValue="active" name="account-state">
          <div className="flex min-h-8 items-center gap-2">
            <RadioGroupItem id="radio-active" value="active" />
            <Label htmlFor="radio-active">Active</Label>
          </div>
          <div className="flex min-h-8 items-center gap-2">
            <RadioGroupItem id="radio-pending" value="pending" />
            <Label htmlFor="radio-pending">Pending</Label>
          </div>
          <div className="flex min-h-8 items-center gap-2">
            <RadioGroupItem id="radio-disabled" value="disabled" disabled />
            <Label htmlFor="radio-disabled">Disabled</Label>
          </div>
        </RadioGroup>
      </fieldset>

      <div className="grid content-start gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="select-state">Select</Label>
          <Select
            defaultValue="active"
            name="state"
            items={{
              active: "Active",
              pending: "Pending",
              suspended: "Suspended",
            }}
          >
            <SelectTrigger id="select-state">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Account state</SelectLabel>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectSeparator />
                <SelectItem value="deleted" disabled>
                  Deleted
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="select-readonly">Read-only select</Label>
          <Select defaultValue="active" readOnly items={{ active: "Active" }}>
            <SelectTrigger id="select-readonly">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="select-invalid">Invalid select</Label>
          <Select>
            <SelectTrigger id="select-invalid" aria-invalid="true">
              <SelectValue placeholder="Choose a state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid content-start gap-1.5 lg:col-span-2">
        <Label htmlFor="textarea-default">Textarea</Label>
        <Textarea id="textarea-default" placeholder="Add an internal note" />
        <Label htmlFor="textarea-readonly" className="mt-3">
          Read-only textarea
        </Label>
        <Textarea id="textarea-readonly" value="Audit record" readOnly />
        <Label htmlFor="textarea-invalid" className="mt-3">
          Invalid textarea
        </Label>
        <Textarea
          id="textarea-invalid"
          defaultValue="Too short"
          aria-invalid="true"
          aria-describedby="textarea-error"
        />
        <p
          id="textarea-error"
          role="alert"
          className="text-sm text-destructive-foreground"
        >
          Enter at least 20 characters.
        </p>
      </div>
    </div>
  ),
}

export const Interactions: Story = {
  render: () => (
    <div className="grid max-w-md gap-5">
      <LabeledCheckbox id="interaction-checkbox" label="검토 완료" />
      <LabeledSwitch id="interaction-switch" label="자동 승인" />
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">처리 상태</legend>
        <RadioGroup defaultValue="waiting" name="interaction-status">
          <div className="flex min-h-8 items-center gap-2">
            <RadioGroupItem id="interaction-waiting" value="waiting" />
            <Label htmlFor="interaction-waiting">대기</Label>
          </div>
          <div className="flex min-h-8 items-center gap-2">
            <RadioGroupItem id="interaction-active" value="active" />
            <Label htmlFor="interaction-active">처리 중</Label>
          </div>
        </RadioGroup>
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor="interaction-select">담당 팀</Label>
        <Select
          defaultValue="operations"
          items={{ operations: "운영팀", risk: "리스크팀" }}
        >
          <SelectTrigger id="interaction-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="operations">운영팀</SelectItem>
            <SelectItem value="risk">리스크팀</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const checkbox = canvas.getByRole("checkbox", { name: "검토 완료" })
    await userEvent.click(checkbox)
    await expect(checkbox).toBeChecked()

    const switchControl = canvas.getByRole("switch", { name: "자동 승인" })
    await userEvent.click(switchControl)
    await expect(switchControl).toBeChecked()

    const waiting = canvas.getByRole("radio", { name: "대기" })
    const active = canvas.getByRole("radio", { name: "처리 중" })
    await userEvent.click(waiting)
    await userEvent.keyboard("{ArrowDown}")
    await expect(active).toBeChecked()

    const select = canvas.getByRole("combobox", { name: "담당 팀" })
    select.focus()
    await userEvent.keyboard("{Enter}")
    const body = within(canvasElement.ownerDocument.body)
    await body.findByRole("listbox")
    const selectedOption = body.getByRole("option", { name: "운영팀" })
    await waitFor(async () => {
      await expect(selectedOption).toHaveFocus()
    })
    await userEvent.keyboard("{ArrowDown}{Enter}")
    await expect(select).toHaveTextContent("리스크팀")
  },
}

function ResponsiveForm() {
  const locale = useLocale()
  const teamOptions =
    locale === "en"
      ? [
          { value: "operations", label: "Operations" },
          { value: "risk", label: "Risk management" },
          { value: "support", label: "Customer support" },
        ]
      : [
          { value: "operations", label: "운영팀" },
          { value: "risk", label: "리스크 관리팀" },
          { value: "support", label: "고객 지원팀" },
        ]
  const copy =
    locale === "en"
      ? {
          title: "Operator access and notification preferences",
          name: "Full operator display name",
          team: "Responsible operations team",
          memo: "Internal review notes and exceptional handling instructions",
          notify: "Send a notification whenever the processing state changes",
          submit: "Save operator configuration",
        }
      : {
          title: "운영자 접근 권한 및 알림 환경 설정",
          name: "운영자 표시 이름",
          team: "담당 운영 조직",
          memo: "내부 검토 메모 및 예외 처리 지침",
          notify: "처리 상태가 변경될 때마다 알림 보내기",
          submit: "운영자 설정 저장",
        }

  return (
    <form
      className="grid w-full max-w-3xl gap-5"
      onSubmit={(event) => {
        event.preventDefault()
      }}
    >
      <h2 className="text-xl font-semibold">{copy.title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="responsive-name">{copy.name}</Label>
          <Input id="responsive-name" name="name" />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="responsive-team">{copy.team}</Label>
          <Select name="team" required items={teamOptions}>
            <SelectTrigger id="responsive-team" className="w-full">
              <SelectValue
                placeholder={locale === "en" ? "Choose a team" : "조직 선택"}
              />
            </SelectTrigger>
            <SelectContent>
              {teamOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="responsive-memo">{copy.memo}</Label>
        <Textarea id="responsive-memo" name="memo" />
      </div>
      <LabeledSwitch id="responsive-notify" label={copy.notify} name="notify" />
      <Button type="submit" className="w-full sm:w-fit">
        {copy.submit}
      </Button>
    </form>
  )
}

export const ResponsiveFormComposition: Story = {
  render: () => <ResponsiveForm />,
}

export const SelectKeyboardFixture: Story = {
  render: () => (
    <div className="grid max-w-xs gap-1.5">
      <Label htmlFor="e2e-select">Account state</Label>
      <Select
        defaultValue="pending"
        items={{
          pending: "Pending review",
          approved: "Approved",
          rejected: "Rejected",
        }}
      >
        <SelectTrigger id="e2e-select" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pending review</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
}
