"use client"

import { entityStatuses } from "@/domain/common"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useTranslations } from "next-intl"

import { useSessionAccess } from "@/auth/session-access-provider"
import { useBackoffice } from "@/application/state/provider"
import { CommandErrorMessage } from "@/application/ui/backoffice-ui"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import { PageHeader } from "@/components/patterns/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { snackbar } from "@/components/ui/snackbar"
import type { BackofficeErrorCode } from "@/domain/common"
import { credentialLifecycleSettingsInputSchema } from "@/features/credentials/model"

export function CredentialLifecycleSettingsPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.apiKeys")
  const settings = backoffice.credentialLifecycleSettings
  const [expirationPeriodDays, setExpirationPeriodDays] = useState(
    String(settings.expirationPeriodDays),
  )
  const [rotationIntervalDays, setRotationIntervalDays] = useState(
    String(settings.rotationIntervalDays),
  )
  const [error, setError] = useState<BackofficeErrorCode>()
  const activeCredentialCount = backoffice.apiKeys.filter(
    (credential) => credential.status === entityStatuses.active,
  ).length

  async function submit() {
    const parsed = credentialLifecycleSettingsInputSchema.safeParse({
      expirationPeriodDays: Number(expirationPeriodDays),
      rotationIntervalDays: Number(rotationIntervalDays),
    })
    if (!parsed.success || !sessionAccess.currentUser) {
      setError("invalid-input")
      return
    }
    const result = await backoffice.updateCredentialLifecycleSettings(
      parsed.data,
      sessionAccess.currentUser.id,
    )
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(undefined)
    snackbar.success(t("lifecycleUpdated"))
    router.push("/credentials")
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      <PageHeader
        title={t("lifecycleSettingsTitle")}
        description={t("lifecycleSettingsDescription")}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("currentLifecycleSettings")}</CardTitle>
          <CardDescription>
            {t("currentLifecycleSettingsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailItem label={t("expirationPeriodDays")}>
              {t("days", { count: settings.expirationPeriodDays })}
            </DetailItem>
            <DetailItem label={t("rotationIntervalDays")}>
              {t("days", { count: settings.rotationIntervalDays })}
            </DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("changeLifecycleSettings")}</CardTitle>
          <CardDescription>
            {t("lifecycleImpactDescription", {
              count: activeCredentialCount,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="credential-lifecycle-settings-form"
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <Field>
              <FieldLabel htmlFor="credential-expiration-period-days">
                {t("expirationPeriodDays")}
              </FieldLabel>
              <Input
                id="credential-expiration-period-days"
                type="number"
                min={1}
                max={3650}
                required
                value={expirationPeriodDays}
                onChange={(event) => {
                  setExpirationPeriodDays(event.currentTarget.value)
                }}
              />
              <FieldDescription>
                {t("expirationPeriodDescription")}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="credential-rotation-interval-days">
                {t("rotationIntervalDays")}
              </FieldLabel>
              <Input
                id="credential-rotation-interval-days"
                type="number"
                min={1}
                max={365}
                required
                value={rotationIntervalDays}
                onChange={(event) => {
                  setRotationIntervalDays(event.currentTarget.value)
                }}
              />
              <FieldDescription>
                {t("commonRotationDescription")}
              </FieldDescription>
            </Field>
            <CommandErrorMessage error={error} />
          </form>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              router.push("/credentials")
            }}
          >
            {common("cancel")}
          </Button>
          <Button type="submit" form="credential-lifecycle-settings-form">
            {common("save")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
