import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ColumnDef } from "@tanstack/react-table"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DataTable } from "@/components/patterns/data-table"

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => {
    return { push }
  },
}))

vi.mock("next-intl", () => ({
  useTranslations:
    () => (key: string, values?: { current?: number; total?: number }) => {
      if (key === "paginationStatus") {
        return `${String(values?.current ?? "")} / ${String(values?.total ?? "")}`
      }
      return (
        {
          all: "All",
          next: "Next",
          pagination: "Pagination",
          previous: "Previous",
        }[key] ?? key
      )
    },
}))

type Row = { name: string; status: string }

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name", size: 240 },
  { accessorKey: "status", header: "Status", size: 120 },
]

afterEach(cleanup)

describe("DataTable", () => {
  it("opens row details by pointer and keyboard without hijacking controls", async () => {
    const user = userEvent.setup()
    const interactiveColumns: ColumnDef<Row>[] = [
      ...columns,
      {
        id: "action",
        header: "Action",
        cell: () => (
          <div>
            <a
              href="/employment-policies/employed"
              onClick={(event) => {
                event.preventDefault()
              }}
            >
              Employment policy
            </a>
            <button type="button">Edit</button>
          </div>
        ),
      },
    ]
    const { unmount } = render(
      <DataTable
        caption="Users"
        columns={interactiveColumns}
        data={[{ name: "Alice", status: "Employed" }]}
        empty="No users"
        getRowHref={(row) => `/users/${row.name.toLocaleLowerCase()}`}
        getRowLabel={(row) => `${row.name} details`}
      />,
    )
    const row = screen.getByRole("row", { name: "Alice details" })

    await user.click(within(row).getByText("Alice"))
    expect(push).toHaveBeenLastCalledWith("/users/alice")

    push.mockClear()
    await user.click(within(row).getByRole("button", { name: "Edit" }))
    expect(push).not.toHaveBeenCalled()
    await user.click(
      within(row).getByRole("link", { name: "Employment policy" }),
    )
    expect(push).not.toHaveBeenCalled()

    row.focus()
    await user.keyboard("{Enter}")
    expect(push).toHaveBeenLastCalledWith("/users/alice")
    unmount()
  })

  it("does not expose row navigation when its target view is unavailable", async () => {
    const user = userEvent.setup()
    push.mockClear()
    render(
      <DataTable
        caption="Users"
        columns={columns}
        data={[{ name: "Alice", status: "Employed" }]}
        empty="No users"
        getRowHref={() => undefined}
        getRowLabel={(row) => `${row.name} details`}
      />,
    )
    const row = screen.getByText("Alice").closest("tr")
    expect(row).not.toBeNull()
    if (!row) return

    expect(row).not.toHaveAttribute("tabindex")
    expect(row).not.toHaveAttribute("aria-label")
    expect(row).not.toHaveClass("cursor-pointer")
    await user.click(row)
    fireEvent.keyDown(row, { key: "Enter" })

    expect(push).not.toHaveBeenCalled()
  })

  it("keeps column widths stable when filtered data changes", () => {
    const { container, rerender } = render(
      <DataTable
        caption="Users"
        columns={columns}
        data={[{ name: "Alice", status: "Employed" }]}
        empty="No users"
      />,
    )

    const initialWidths = Array.from(container.querySelectorAll("col")).map(
      (column) => column.getAttribute("style"),
    )

    rerender(
      <DataTable
        caption="Users"
        columns={columns}
        data={[]}
        empty="No users"
      />,
    )

    expect(container.querySelector("table")).toHaveClass("table-fixed")
    expect(initialWidths).toEqual(["width: 240px;", "width: 120px;"])
    expect(
      Array.from(container.querySelectorAll("col")).map((column) =>
        column.getAttribute("style"),
      ),
    ).toEqual(initialWidths)
  })

  it("keeps the list area at least as tall as its empty state", () => {
    const { container, rerender } = render(
      <DataTable
        caption="Users"
        columns={columns}
        data={[{ name: "Alice", status: "Employed" }]}
        empty="No users"
      />,
    )

    expect(
      container.querySelector('[data-slot="table-container"]'),
    ).toHaveClass("min-h-40")

    rerender(
      <DataTable
        caption="Users"
        columns={columns}
        data={[]}
        empty="No users"
      />,
    )

    expect(
      container.querySelector('[data-slot="table-container"]'),
    ).toHaveClass("min-h-40")
    expect(screen.getByText("No users").closest("td")).toHaveClass("h-32")
  })

  it("keeps long header and cell text inside its assigned column", () => {
    const { container } = render(
      <DataTable
        caption="Long values"
        columns={columns}
        data={[
          {
            name: "unbroken-user-name-that-is-longer-than-the-column-width",
            status: "Employed",
          },
        ]}
        empty="No users"
      />,
    )
    const table = within(container)

    expect(table.getByRole("columnheader", { name: "Name" })).toHaveClass(
      "overflow-hidden",
      "whitespace-normal",
      "[overflow-wrap:anywhere]",
    )
    expect(
      table
        .getByText("unbroken-user-name-that-is-longer-than-the-column-width")
        .closest("td"),
    ).toHaveClass(
      "overflow-hidden",
      "whitespace-normal",
      "[overflow-wrap:anywhere]",
    )
  })

  it("filters with one query for the selected column", async () => {
    const user = userEvent.setup()
    render(
      <DataTable
        caption="Users"
        columns={columns}
        data={[
          { name: "Alice", status: "Employed" },
          { name: "Alicia", status: "On leave" },
          { name: "Bob", status: "Employed" },
        ]}
        empty="No users"
        noResults="No results"
        filterLabel="Search conditions"
        filters={[
          { id: "name", label: "Name", getValue: (row) => row.name },
          { id: "status", label: "Status", getValue: (row) => row.status },
        ]}
      />,
    )

    expect(screen.getAllByRole("searchbox")).toHaveLength(1)
    await user.type(screen.getByRole("searchbox", { name: "Name" }), "ali")

    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Alicia")).toBeInTheDocument()
    expect(screen.queryByText("Bob")).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("combobox", { name: "Search conditions" }),
    )
    await user.click(await screen.findByRole("option", { name: "Status" }))

    expect(screen.getAllByRole("searchbox")).toHaveLength(1)
    expect(screen.getByText("Bob")).toBeInTheDocument()
    await user.type(
      screen.getByRole("searchbox", { name: "Status" }),
      "employed",
    )
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.queryByText("Alicia")).not.toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()

    await user.clear(screen.getByRole("searchbox", { name: "Status" }))
    await user.type(screen.getByRole("searchbox", { name: "Status" }), "none")
    expect(screen.getByText("No results")).toBeInTheDocument()
  })

  it("does not show a condition selector for one filter", () => {
    const { container } = render(
      <DataTable
        caption="Users"
        columns={columns}
        data={[{ name: "Alice", status: "Employed" }]}
        empty="No users"
        filterLabel="Search conditions"
        filters={[{ id: "name", label: "Name", getValue: (row) => row.name }]}
      />,
    )
    const tableRegion = within(container)

    expect(tableRegion.queryByRole("combobox")).not.toBeInTheDocument()
    expect(
      tableRegion.getByRole("searchbox", { name: "Name" }),
    ).toBeInTheDocument()
  })

  it("shows at most 20 rows per page and resets to the first page when searched", async () => {
    const user = userEvent.setup()
    const data = Array.from({ length: 45 }, (_, index) => ({
      name: `User ${String(index + 1).padStart(2, "0")}`,
      status: "Employed",
    }))
    render(
      <DataTable
        caption="Users"
        columns={columns}
        data={data}
        empty="No users"
        filters={[{ id: "name", label: "Name", getValue: (row) => row.name }]}
      />,
    )

    expect(screen.getAllByRole("row")).toHaveLength(21)
    expect(screen.getByText("User 01")).toBeInTheDocument()
    expect(screen.queryByText("User 21")).not.toBeInTheDocument()
    expect(screen.getByText("1 / 3")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByText("User 21")).toBeInTheDocument()
    expect(screen.getByText("2 / 3")).toBeInTheDocument()

    await user.type(screen.getByRole("searchbox", { name: "Name" }), "45")
    expect(screen.getByText("User 45")).toBeInTheDocument()
    expect(
      screen.queryByRole("navigation", { name: "Pagination" }),
    ).not.toBeInTheDocument()
  })

  it("provides an all-column search when explicit filters are omitted", async () => {
    const user = userEvent.setup()
    render(
      <DataTable
        caption="Users"
        columns={columns}
        data={[
          { name: "Alice", status: "Employed" },
          { name: "Bob", status: "On leave" },
        ]}
        empty="No users"
      />,
    )

    await user.type(screen.getByRole("searchbox", { name: "All" }), "leave")
    expect(screen.queryByText("Alice")).not.toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
  })
})
