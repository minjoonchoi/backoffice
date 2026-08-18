"use client"

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useId, useMemo, useState, type ReactNode } from "react"

import { FilterBar } from "@/components/patterns/filter-bar"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type DataTableFilter<Row> = {
  id: string
  label: string
  getValue: (row: Row) => string
}

const NO_FILTERS: [] = []
const PAGE_SIZE = 20

function rowSearchValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  ) {
    return String(value)
  }
  if (Array.isArray(value)) return value.map(rowSearchValue).join(" ")
  if (typeof value === "object") {
    return Object.values(value).map(rowSearchValue).join(" ")
  }
  return ""
}

type DataTableProps<Row> = {
  caption: string
  columns: ColumnDef<Row>[]
  data: Row[]
  empty: ReactNode
  getRowId?: (row: Row) => string
  getRowHref?: (row: Row) => string | undefined
  getRowLabel?: (row: Row) => string
  filters?: DataTableFilter<Row>[]
  filterLabel?: string
  noResults?: ReactNode
}

export function DataTable<Row>({
  caption,
  columns,
  data,
  empty,
  getRowId,
  getRowHref,
  getRowLabel,
  filters = NO_FILTERS,
  filterLabel = "Filters",
  noResults = empty,
}: DataTableProps<Row>) {
  const router = useRouter()
  const common = useTranslations("backoffice.common")
  const filterIdPrefix = useId()
  const [selectedFilterId, setSelectedFilterId] = useState(
    () => filters[0]?.id ?? "",
  )
  const [filterValue, setFilterValue] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const fallbackFilter = useMemo<DataTableFilter<Row>>(
    () => ({
      id: "all-columns",
      label: common("all"),
      getValue: rowSearchValue,
    }),
    [common],
  )
  const effectiveFilters = filters.length > 0 ? filters : [fallbackFilter]
  const selectedFilter =
    effectiveFilters.find((filter) => filter.id === selectedFilterId) ??
    effectiveFilters[0]
  const normalizedFilterValue = filterValue.trim().toLocaleLowerCase()
  const hasActiveFilters = normalizedFilterValue.length > 0
  const filteredData = useMemo(
    () =>
      selectedFilter && normalizedFilterValue
        ? data.filter((row) =>
            selectedFilter
              .getValue(row)
              .toLocaleLowerCase()
              .includes(normalizedFilterValue),
          )
        : data,
    [data, normalizedFilterValue, selectedFilter],
  )
  const pageCount = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE))
  const currentPageIndex = Math.min(pageIndex, pageCount - 1)
  const paginatedData = useMemo(
    () =>
      filteredData.slice(
        currentPageIndex * PAGE_SIZE,
        (currentPageIndex + 1) * PAGE_SIZE,
      ),
    [currentPageIndex, filteredData],
  )
  const table = useReactTable({
    columns,
    data: paginatedData,
    getCoreRowModel: getCoreRowModel(),
    ...(getRowId ? { getRowId } : {}),
  })

  return (
    <div className="grid gap-3">
      {effectiveFilters.length > 0 ? (
        <FilterBar label={filterLabel}>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)] lg:col-span-3">
            {effectiveFilters.length > 1 && selectedFilter ? (
              <Field>
                <FieldLabel htmlFor={`${filterIdPrefix}-condition`}>
                  {filterLabel}
                </FieldLabel>
                <Select
                  value={selectedFilter.id}
                  items={effectiveFilters.map((filter) => ({
                    value: filter.id,
                    label: filter.label,
                  }))}
                  onValueChange={(value) => {
                    if (value) {
                      setSelectedFilterId(value)
                      setFilterValue("")
                      setPageIndex(0)
                    }
                  }}
                >
                  <SelectTrigger
                    id={`${filterIdPrefix}-condition`}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {effectiveFilters.map((filter) => (
                      <SelectItem key={filter.id} value={filter.id}>
                        {filter.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {selectedFilter ? (
              <Field>
                <FieldLabel htmlFor={`${filterIdPrefix}-query`}>
                  {selectedFilter.label}
                </FieldLabel>
                <Input
                  id={`${filterIdPrefix}-query`}
                  type="search"
                  value={filterValue}
                  onChange={(event) => {
                    setFilterValue(event.currentTarget.value)
                    setPageIndex(0)
                  }}
                />
              </Field>
            ) : null}
          </div>
        </FilterBar>
      ) : null}
      <Table
        className="table-fixed"
        containerClassName="min-h-40"
        style={{ minWidth: table.getTotalSize() }}
      >
        <TableCaption className="sr-only">{caption}</TableCaption>
        <colgroup>
          {table.getVisibleLeafColumns().map((column) => (
            <col key={column.id} style={{ width: column.getSize() }} />
          ))}
        </colgroup>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => {
              const href = getRowHref?.(row.original)
              return (
                <TableRow
                  key={row.id}
                  tabIndex={href ? 0 : undefined}
                  aria-label={href ? getRowLabel?.(row.original) : undefined}
                  className={
                    href
                      ? "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                      : undefined
                  }
                  onClick={(event) => {
                    if (!href) return
                    const target = event.target
                    if (
                      target instanceof Element &&
                      target.closest(
                        "a, button, input, select, textarea, label, [contenteditable='true'], [role='button'], [role='link'], [role='checkbox'], [role='switch']",
                      )
                    ) {
                      return
                    }
                    router.push(href)
                  }}
                  onKeyDown={(event) => {
                    if (
                      href &&
                      event.key === "Enter" &&
                      event.target === event.currentTarget
                    ) {
                      router.push(href)
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="h-32 text-center whitespace-normal text-text-subtle"
              >
                {hasActiveFilters ? noResults : empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {filteredData.length > PAGE_SIZE ? (
        <nav
          className="flex items-center justify-end gap-2"
          aria-label={common("pagination")}
        >
          <span className="text-sm text-muted-foreground">
            {common("paginationStatus", {
              current: currentPageIndex + 1,
              total: pageCount,
            })}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={currentPageIndex === 0}
            onClick={() => {
              setPageIndex((current) => Math.max(0, current - 1))
            }}
          >
            {common("previous")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={currentPageIndex >= pageCount - 1}
            onClick={() => {
              setPageIndex((current) => Math.min(pageCount - 1, current + 1))
            }}
          >
            {common("next")}
          </Button>
        </nav>
      ) : null}
    </div>
  )
}
