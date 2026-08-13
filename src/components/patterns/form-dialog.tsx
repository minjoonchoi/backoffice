"use client"

import { useTranslations } from "next-intl"
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent } from "@/components/ui/dialog"

const MarkFormDialogDirtyContext = createContext<(() => void) | null>(null)

type FormDialogProps = Omit<
  ComponentProps<typeof Dialog>,
  "open" | "onOpenChange"
> & {
  open: boolean
  onOpenChange: (open: boolean) => void
  hasChanges?: boolean
  children: ReactNode
}

export function FormDialog({
  open,
  onOpenChange,
  hasChanges = false,
  children,
  ...props
}: FormDialogProps) {
  const common = useTranslations("backoffice.common")
  const [internalChanges, setInternalChanges] = useState(false)
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const markDirty = useCallback(() => {
    setInternalChanges(true)
  }, [])

  function changeOpen(nextOpen: boolean) {
    if (nextOpen) {
      setInternalChanges(false)
      onOpenChange(true)
      return
    }
    if (internalChanges || hasChanges) {
      setConfirmationOpen(true)
      return
    }
    onOpenChange(false)
  }

  function discardChanges() {
    setConfirmationOpen(false)
    setInternalChanges(false)
    onOpenChange(false)
  }

  return (
    <MarkFormDialogDirtyContext.Provider value={markDirty}>
      <Dialog open={open} onOpenChange={changeOpen} {...props}>
        {children}
      </Dialog>
      <AlertDialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{common("discardChangesTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {common("discardChangesDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{common("continueEditing")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={discardChanges}>
              {common("discardChanges")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MarkFormDialogDirtyContext.Provider>
  )
}

export function FormDialogContent({
  onInputCapture,
  onChangeCapture,
  ...props
}: ComponentProps<typeof DialogContent>) {
  const markDirty = useContext(MarkFormDialogDirtyContext)

  return (
    <DialogContent
      onInputCapture={(event) => {
        onInputCapture?.(event)
        markDirty?.()
      }}
      onChangeCapture={(event) => {
        onChangeCapture?.(event)
        markDirty?.()
      }}
      {...props}
    />
  )
}
