import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import type { ColumnDef } from "@tanstack/react-table"
import { Database } from "lucide-react"
import { useState } from "react"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/patterns/content-state"
import { ConfirmAction } from "@/components/patterns/confirm-action"
import { DataTable } from "@/components/patterns/data-table"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import { FilterBar } from "@/components/patterns/filter-bar"
import { PageHeader } from "@/components/patterns/page-header"
import { MetricCard } from "@/components/patterns/metric-card"
import { RequestDialog } from "@/components/patterns/request-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const meta = {
  title: "Patterns/Foundation",
} satisfies Meta

export default meta
type Story = StoryObj

export const Header: Story = {
  render: () => (
    <PageHeader
      eyebrow="Platform foundation"
      title="Page title"
      description="A concise description keeps page intent clear."
      actions={<Button>Primary action</Button>}
    />
  ),
}

export const Filters: Story = {
  render: () => (
    <FilterBar label="Filters" actions={<Button>Apply</Button>}>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-query">Query</Label>
        <Input id="filter-query" />
      </div>
    </FilterBar>
  ),
}

const patternRows = [
  { id: "table", name: "Data table", status: "Ready" },
  { id: "detail", name: "Detail grid", status: "Ready" },
]
const patternColumns: ColumnDef<(typeof patternRows)[number]>[] = [
  { accessorKey: "name", header: "Pattern" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant="success">{row.original.status}</Badge>,
  },
]

export const ListAndDetail: Story = {
  render: () => (
    <div className="grid max-w-4xl gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard icon={Database} title="Patterns" value={2} />
        <MetricCard
          icon={Database}
          title="Active"
          value={2}
          description="Current documented patterns"
        />
      </div>
      <DataTable
        caption="Pattern readiness"
        columns={patternColumns}
        data={patternRows}
        getRowId={(row) => row.id}
        empty="No patterns"
        noResults="No matching patterns"
        filterLabel="Search conditions"
        filters={[
          { id: "name", label: "Pattern", getValue: (row) => row.name },
          { id: "status", label: "Status", getValue: (row) => row.status },
        ]}
      />
      <DetailGrid>
        <DetailItem label="Name">Data table</DetailItem>
        <DetailItem label="Purpose">Dense list pages</DetailItem>
        <DetailItem label="Keyboard">Native table navigation</DetailItem>
        <DetailItem label="Status">Ready</DetailItem>
      </DetailGrid>
    </div>
  ),
}

function RequestDialogFixture() {
  const [open, setOpen] = useState(false)
  return (
    <RequestDialog
      open={open}
      onOpenChange={setOpen}
      triggerLabel="Create request"
      title="Create approval request"
      description="Each business page supplies its request fields in one form."
      cancelLabel="Cancel"
      submitLabel="Submit"
      onSubmit={fn()}
    >
      <Input aria-label="Request name" />
      <Input aria-label="Request reason" />
    </RequestDialog>
  )
}

export const RequestModal: Story = {
  render: () => <RequestDialogFixture />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("button", { name: "Create request" }),
    )
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(async () => {
      await expect(
        body.getByRole("textbox", { name: "Request name" }),
      ).toBeVisible()
      await expect(
        body.getByRole("textbox", { name: "Request reason" }),
      ).toBeVisible()
    })
    const requestName = body.getByRole("textbox", { name: "Request name" })
    await userEvent.type(requestName, "Access request")
    await userEvent.click(body.getByRole("button", { name: "Cancel" }))
    const confirmation = body.getByRole("alertdialog")
    await waitFor(async () => {
      await expect(confirmation).toBeVisible()
    })
    await expect(
      within(confirmation).getByRole("heading", {
        name: /작성 중인 내용을 취소할까요\?|Discard your changes\?/,
      }),
    ).toBeVisible()
    await userEvent.click(
      within(confirmation).getByRole("button", {
        name: /계속 작성|Continue editing/,
      }),
    )
    await expect(requestName).toHaveValue("Access request")
    await userEvent.click(body.getByRole("button", { name: "Cancel" }))
    await userEvent.click(
      within(body.getByRole("alertdialog")).getByRole("button", {
        name: /작성 취소|Discard changes/,
      }),
    )
    await waitFor(async () => {
      await expect(body.queryByRole("dialog")).not.toBeInTheDocument()
    })
    await userEvent.click(
      canvas.getByRole("button", { name: "Create request" }),
    )
    await expect(
      body.getByRole("textbox", { name: "Request name" }),
    ).toHaveValue("")
  },
}

export const Loading: Story = {
  render: () => (
    <LoadingState title="Loading" description="Preparing the content." />
  ),
}

export const Empty: Story = {
  render: () => (
    <EmptyState
      title="No items to display"
      description="Change the conditions or add a new item."
      action={<Button variant="outline">Clear filters</Button>}
    />
  ),
}

export const Error: Story = {
  render: () => (
    <ErrorState
      title="Unable to load content"
      description="Please try again in a moment."
      retryLabel="Try again"
      onRetry={fn()}
    />
  ),
}

export const Confirm: Story = {
  render: () => (
    <ConfirmAction
      trigger="Open confirmation"
      title="Continue with this action?"
      description="This action cannot be undone after confirmation."
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      onConfirm={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("button", { name: "Open confirmation" }),
    )
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(async () => {
      await expect(body.getByRole("alertdialog")).toBeVisible()
    })
    await userEvent.keyboard("{Escape}")
    await waitFor(async () => {
      await expect(body.queryByRole("alertdialog")).not.toBeInTheDocument()
    })
  },
}

export const ConfirmKeyboard: Story = {
  render: () => (
    <ConfirmAction
      trigger="Open confirmation"
      title="Continue with this action?"
      description="This action cannot be undone after confirmation."
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      onConfirm={fn()}
    />
  ),
}

export const ConfirmDisabled: Story = {
  render: () => (
    <ConfirmAction
      trigger="Open confirmation"
      title="Continue with this action?"
      description="This action cannot be undone after confirmation."
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      disabled
      onConfirm={fn()}
    />
  ),
}
