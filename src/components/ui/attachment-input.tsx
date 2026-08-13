"use client"

import {
  AlertCircleIcon,
  FileIcon,
  RotateCcwIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"
import type * as React from "react"

import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type AttachmentValidationOptions = {
  accept?: string | undefined
  maxFiles?: number | undefined
  maxSize?: number | undefined
}

type AttachmentValidationError =
  | { code: "too-many-files"; maxFiles: number }
  | { code: "file-too-large"; file: File; maxSize: number }
  | { code: "file-type-not-accepted"; file: File; accept: string }

type AttachmentValidationResult =
  | { files: File[]; errors: [] }
  | { files: []; errors: AttachmentValidationError[] }

function matchesAcceptedType(file: File, accept: string) {
  const fileName = file.name.toLowerCase()
  const fileType = file.type.toLowerCase()

  return accept
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .some((value) => {
      if (value.startsWith(".")) return fileName.endsWith(value)
      if (value.endsWith("/*")) return fileType.startsWith(value.slice(0, -1))
      return fileType === value
    })
}

function validateAttachmentFiles(
  files: readonly File[],
  { accept, maxFiles = 1, maxSize }: AttachmentValidationOptions = {},
): AttachmentValidationResult {
  if (!Number.isInteger(maxFiles) || maxFiles < 1) {
    throw new RangeError("maxFiles must be a positive integer")
  }
  if (maxSize !== undefined && (!Number.isFinite(maxSize) || maxSize <= 0)) {
    throw new RangeError("maxSize must be a positive number")
  }

  const errors: AttachmentValidationError[] = []
  if (files.length > maxFiles) {
    errors.push({ code: "too-many-files", maxFiles })
  }

  for (const file of files) {
    if (maxSize !== undefined && file.size > maxSize) {
      errors.push({ code: "file-too-large", file, maxSize })
    }
    if (accept && !matchesAcceptedType(file, accept)) {
      errors.push({ code: "file-type-not-accepted", file, accept })
    }
  }

  return errors.length > 0
    ? { files: [], errors }
    : { files: [...files], errors: [] }
}

type AttachmentInputProps = Omit<
  React.ComponentProps<"input">,
  "children" | "onChange" | "type" | "value"
> &
  AttachmentValidationOptions & {
    children: React.ReactNode
    onFilesChange: (result: AttachmentValidationResult) => void
  }

function AttachmentInput({
  className,
  children,
  accept,
  maxFiles = 1,
  maxSize,
  multiple,
  disabled,
  onFilesChange,
  ...props
}: AttachmentInputProps) {
  return (
    <label
      data-slot="attachment-input"
      data-disabled={disabled ? "" : undefined}
      className={cn(
        "inline-flex h-control cursor-pointer items-center justify-center gap-1.5 rounded-control border border-control-border bg-control px-3 text-body font-medium transition-[background-color,border-color,box-shadow] outline-none focus-within:border-ring focus-within:ring-2 focus-within:ring-ring hover:border-control-border-hover hover:bg-control-hover data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50 [&_svg]:size-4",
        className,
      )}
    >
      <input
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          onFilesChange(
            validateAttachmentFiles(files, { accept, maxFiles, maxSize }),
          )
          event.currentTarget.value = ""
        }}
        {...props}
      />
      <UploadIcon aria-hidden="true" />
      {children}
    </label>
  )
}

function AttachmentList({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="attachment-list"
      className={cn("grid gap-2", className)}
      {...props}
    />
  )
}

type AttachmentAction = {
  label: string
  onClick: () => void
}

type AttachmentItemProps = Omit<React.ComponentProps<"li">, "children"> & {
  fileName: string
  description?: string
  state?: "ready" | "uploading" | "error" | "disabled"
  progress?: number
  removeAction?: AttachmentAction
  retryAction?: AttachmentAction
}

function AttachmentItem({
  className,
  fileName,
  description,
  state = "ready",
  progress,
  removeAction,
  retryAction,
  ...props
}: AttachmentItemProps) {
  return (
    <li
      data-slot="attachment-item"
      data-state={state}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-control border border-border bg-surface p-2.5 text-body data-[state=disabled]:opacity-50 data-[state=error]:border-destructive-foreground/40",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-sm bg-secondary text-text-subtle",
          state === "error" && "bg-destructive text-destructive-foreground",
        )}
      >
        {state === "error" ? (
          <AlertCircleIcon aria-hidden="true" className="size-4" />
        ) : (
          <FileIcon aria-hidden="true" className="size-4" />
        )}
      </span>
      <div className="grid min-w-0 flex-1 gap-1">
        <span className="truncate font-medium text-text-strong">
          {fileName}
        </span>
        {description ? (
          <span
            className={cn(
              "text-caption text-text-subtle",
              state === "error" && "text-destructive-foreground",
            )}
          >
            {description}
          </span>
        ) : null}
        {state === "uploading" ? (
          <Progress
            value={progress ?? null}
            aria-label={description ?? fileName}
          />
        ) : null}
      </div>
      {retryAction && state === "error" ? (
        <button
          type="button"
          aria-label={retryAction.label}
          onClick={retryAction.onClick}
          className="inline-flex size-control-sm items-center justify-center rounded-sm outline-none hover:bg-control-hover focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCcwIcon aria-hidden="true" className="size-4" />
        </button>
      ) : null}
      {removeAction ? (
        <button
          type="button"
          aria-label={removeAction.label}
          onClick={removeAction.onClick}
          disabled={state === "disabled"}
          className="inline-flex size-control-sm items-center justify-center rounded-sm text-text-subtle outline-none hover:bg-control-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
        >
          <Trash2Icon aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </li>
  )
}

export {
  AttachmentInput,
  AttachmentItem,
  AttachmentList,
  validateAttachmentFiles,
}
export type {
  AttachmentValidationError,
  AttachmentValidationOptions,
  AttachmentValidationResult,
}
