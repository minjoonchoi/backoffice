"use client"

import { Siren } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import { useBackoffice } from "@/application/state/provider"
import { CommandErrorMessage } from "@/application/ui/backoffice-ui"
import {
  FormDialog,
  FormDialogContent,
} from "@/components/patterns/form-dialog"
import { Button } from "@/components/ui/button"
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import type { BackofficeErrorCode } from "@/domain/common"
import type { ApiKey } from "@/features/credentials/model"

export function CredentialEmergencyRevokeDialog({
  credential,
}: {
  credential: ApiKey
}) {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.apiKeys")
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<BackofficeErrorCode>()

  async function submit(form: HTMLFormElement) {
    const reason = new FormData(form).get("reason")
    if (typeof reason !== "string" || !sessionAccess.currentUser) {
      setError("invalid-input")
      return
    }
    const result = await backoffice.emergencyRevokeApiKey({
      apiKeyId: credential.id,
      requesterId: sessionAccess.currentUser.id,
      reason,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(t("emergencyRevoked"))
    setOpen(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        setError(undefined)
      }}
    >
      <DialogTrigger render={<Button variant="destructive" />}>
        <Siren />
        {t("emergencyRevoke")}
      </DialogTrigger>
      <FormDialogContent>
        <DialogHeader>
          <DialogTitle>{t("emergencyRevokeTitle")}</DialogTitle>
          <DialogDescription>
            {t("emergencyRevokeDescription")}
          </DialogDescription>
        </DialogHeader>
        <form
          id="credential-emergency-revoke-form"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(event.currentTarget)
          }}
        >
          <Field>
            <FieldLabel htmlFor="credential-emergency-reason">
              {t("emergencyRevokeReason")}
            </FieldLabel>
            <Textarea
              id="credential-emergency-reason"
              name="reason"
              required
              minLength={10}
              maxLength={500}
              rows={5}
            />
          </Field>
          <CommandErrorMessage error={error} />
        </form>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {common("cancel")}
          </DialogClose>
          <Button
            type="submit"
            form="credential-emergency-revoke-form"
            variant="destructive"
          >
            {t("emergencyRevoke")}
          </Button>
        </DialogFooter>
      </FormDialogContent>
    </FormDialog>
  )
}
