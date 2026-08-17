"use client"

import { serviceTypeValues } from "@/features/service-catalog/model"
import { entityStatuses } from "@/domain/common"
import { ArrowLeft, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useId, useMemo, useState } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import {
  canManageService,
  resolveServiceResourceAccess,
} from "@/auth/service-resource-access"
import { useBackoffice } from "@/application/state/provider"
import { CommandErrorMessage } from "@/application/ui/backoffice-ui"
import { FormSelect } from "@/components/patterns/form-select"
import { PageHeader } from "@/components/patterns/page-header"
import {
  ReviewWorkflowProgress,
  type ReviewWorkflowStep,
} from "@/components/patterns/review-workflow-progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { snackbar } from "@/components/ui/snackbar"
import { Textarea } from "@/components/ui/textarea"
import type { BackofficeErrorCode } from "@/domain/common"
import type {
  EndpointSyncKind,
  EndpointSyncOperation,
  EndpointSyncPlan,
} from "@/features/service-catalog/endpoint-sync"
import { endpointSyncKinds } from "@/features/service-catalog/endpoint-sync"
import {
  parseOpenApiEndpoints,
  type OpenApiImportPreview,
} from "@/features/service-catalog/openapi-import"
import type { ServiceEndpointSyncManifestInput } from "@/features/service-catalog/api"

function manifestInput(
  preview: OpenApiImportPreview,
  serviceId: string,
): ServiceEndpointSyncManifestInput {
  return {
    serviceId,
    endpoints: preview.endpoints.map((endpoint) => ({
      name: endpoint.name,
      method: endpoint.method,
      path: endpoint.path,
      version: endpoint.version,
      lifecycle: endpoint.lifecycle,
      fields: endpoint.fields,
    })),
  }
}

function operationEndpoint(operation: EndpointSyncOperation) {
  return operation.next ?? operation.current
}

function operationBadgeVariant(kind: EndpointSyncKind) {
  switch (kind) {
    case endpointSyncKinds.add:
      return "success" as const
    case endpointSyncKinds.update:
      return "info" as const
    case endpointSyncKinds.delete:
      return "destructive" as const
    case endpointSyncKinds.unchanged:
      return "secondary" as const
  }
}

export function ServiceEndpointSyncPage() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  const router = useRouter()
  const t = useTranslations("backoffice.endpoints")
  const common = useTranslations("backoffice.common")
  const sourceId = useId()
  const requesterId = sessionAccess.currentUser?.id ?? null
  const access = resolveServiceResourceAccess(backoffice, requesterId)
  const services = backoffice.services.filter(
    (service) =>
      service.status === entityStatuses.active &&
      service.type === serviceTypeValues.internal &&
      canManageService(access, service),
  )
  const [serviceId, setServiceId] = useState<string | null>(
    services[0]?.id ?? null,
  )
  const [source, setSource] = useState("")
  const [manifest, setManifest] = useState<OpenApiImportPreview | null>(null)
  const [plan, setPlan] = useState<EndpointSyncPlan | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<ReviewWorkflowStep>(1)
  const [error, setError] = useState<BackofficeErrorCode>()
  const [parseFailed, setParseFailed] = useState(false)
  const selectedOperations = useMemo(
    () =>
      plan?.operations.filter((operation) => selectedKeys.has(operation.key)) ??
      [],
    [plan, selectedKeys],
  )
  const affectedUserIds = useMemo(
    () => [
      ...new Set(
        selectedOperations.flatMap(
          (operation) => operation.impact.affectedUserIds,
        ),
      ),
    ],
    [selectedOperations],
  )
  const affectedPolicyIds = useMemo(
    () => [
      ...new Set(
        selectedOperations.flatMap(
          (operation) => operation.impact.accessPolicyIds,
        ),
      ),
    ],
    [selectedOperations],
  )
  const affectedCredentialIds = useMemo(
    () => [
      ...new Set(
        selectedOperations.flatMap(
          (operation) => operation.impact.credentialIds,
        ),
      ),
    ],
    [selectedOperations],
  )

  async function reviewManifest() {
    if (!serviceId || !requesterId) {
      setError("endpoint-sync-forbidden")
      return
    }
    try {
      const nextManifest = parseOpenApiEndpoints(source, serviceId)
      const result = await backoffice.analyzeServiceEndpointSync(
        manifestInput(nextManifest, serviceId),
        requesterId,
      )
      if (!result.ok) {
        setError(result.error)
        return
      }
      setManifest(nextManifest)
      setPlan(result.value)
      setSelectedKeys(
        new Set(
          result.value.operations
            .filter(
              (operation) =>
                operation.kind !== endpointSyncKinds.unchanged &&
                !operation.blockedReason,
            )
            .map((operation) => operation.key),
        ),
      )
      setParseFailed(false)
      setError(undefined)
    } catch {
      setManifest(null)
      setPlan(null)
      setSelectedKeys(new Set())
      setParseFailed(true)
      setError("invalid-input")
    }
  }

  function toggleOperation(operation: EndpointSyncOperation, checked: boolean) {
    if (
      operation.kind === endpointSyncKinds.unchanged ||
      operation.blockedReason
    ) {
      return
    }
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (checked) next.add(operation.key)
      else next.delete(operation.key)
      return next
    })
    setError(undefined)
  }

  async function synchronize() {
    if (!manifest || !serviceId || !requesterId || selectedKeys.size === 0) {
      setError("invalid-input")
      return
    }
    const result = await backoffice.synchronizeServiceEndpoints(
      manifestInput(manifest, serviceId),
      [...selectedKeys],
      requesterId,
    )
    if (!result.ok) {
      setError(result.error)
      return
    }
    snackbar.success(
      t("syncCompleted", {
        added: result.value.addedCount,
        updated: result.value.updatedCount,
        deleted: result.value.deletedCount,
      }),
    )
    router.push("/service-endpoints")
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("syncOpenApi")}
        description={t("syncDescription")}
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/service-endpoints" />}
          >
            <ArrowLeft aria-hidden />
            {common("backToList")}
          </Button>
        }
      />
      <Card>
        <CardContent className="grid gap-4">
          <ReviewWorkflowProgress step={step} label={t("syncProgress")} />
          {step === 1 ? (
            <section
              className="grid gap-4"
              aria-labelledby={`${sourceId}-title`}
            >
              <div className="grid gap-1">
                <h2
                  id={`${sourceId}-title`}
                  className="text-base font-semibold"
                >
                  {t("syncSourceTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("syncSourceDescription")}
                </p>
              </div>
              <FormSelect
                label={t("service")}
                value={serviceId}
                onValueChange={(value) => {
                  setServiceId(value)
                  setManifest(null)
                  setPlan(null)
                  setSelectedKeys(new Set())
                  setError(undefined)
                }}
                options={services.map((service) => ({
                  value: service.id,
                  label: service.name,
                }))}
              />
              <Field>
                <FieldLabel htmlFor={sourceId}>
                  {t("openApiDocument")}
                </FieldLabel>
                <Textarea
                  id={sourceId}
                  value={source}
                  onChange={(event) => {
                    setSource(event.target.value)
                    setManifest(null)
                    setPlan(null)
                    setSelectedKeys(new Set())
                    setParseFailed(false)
                    setError(undefined)
                  }}
                  rows={16}
                  className="max-h-[26rem] overflow-y-auto font-mono text-xs"
                  placeholder={t("openApiPlaceholder")}
                />
                <FieldDescription>{t("openApiFormats")}</FieldDescription>
              </Field>
              {parseFailed ? (
                <p className="text-sm text-destructive-foreground">
                  {t("openApiParseError")}
                </p>
              ) : null}
            </section>
          ) : null}
          {step === 1 && plan && manifest ? (
            <section
              className="grid min-h-0 gap-4"
              aria-labelledby={`${sourceId}-impact-title`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-1">
                  <h2
                    id={`${sourceId}-impact-title`}
                    className="text-base font-semibold"
                  >
                    {t("syncImpactTitle")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {manifest.title} · {manifest.version} ·{" "}
                    {t("syncImpactDescription")}
                  </p>
                </div>
                <Badge variant="info">
                  {t("selectedEndpointCount", { count: selectedKeys.size })}
                </Badge>
              </div>
              <fieldset className="grid max-h-[36rem] gap-2 overflow-y-auto rounded-card border p-2">
                <legend className="sr-only">{t("syncImpactTitle")}</legend>
                {plan.operations.map((operation) => {
                  const endpoint = operationEndpoint(operation)
                  if (!endpoint) return null
                  const selectable =
                    operation.kind !== endpointSyncKinds.unchanged &&
                    !operation.blockedReason
                  return (
                    <label
                      key={operation.key}
                      className={`flex max-h-24 min-h-16 items-start gap-3 overflow-hidden rounded-control px-3 py-2 ${selectable ? "cursor-pointer hover:bg-control-hover" : "bg-surface-subtle text-muted-foreground"}`}
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={selectedKeys.has(operation.key)}
                        disabled={!selectable}
                        onCheckedChange={(checked) => {
                          toggleOperation(operation, checked)
                        }}
                      />
                      <span className="grid min-w-0 flex-1 gap-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <Badge
                            variant={operationBadgeVariant(operation.kind)}
                          >
                            {t(`syncKinds.${operation.kind}`)}
                          </Badge>
                          <Badge variant="outline">{endpoint.method}</Badge>
                          <code className="truncate text-xs">
                            {endpoint.path}
                          </code>
                        </span>
                        <span className="truncate text-sm font-medium">
                          {endpoint.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {t("syncRowImpact", {
                            fields:
                              operation.impact.addedFieldCount +
                              operation.impact.changedFieldCount +
                              operation.impact.removedFieldCount,
                            policies: operation.impact.accessPolicyIds.length,
                            credentials: operation.impact.credentialIds.length,
                            users: operation.impact.affectedUserIds.length,
                          })}
                        </span>
                        {operation.blockedReason ? (
                          <span className="truncate text-xs text-destructive-foreground">
                            {t("syncDeleteBlocked")}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  )
                })}
              </fieldset>
            </section>
          ) : null}
          {step === 2 && plan ? (
            <section
              className="grid gap-4"
              aria-labelledby={`${sourceId}-review-title`}
            >
              <div className="grid gap-1">
                <h2
                  id={`${sourceId}-review-title`}
                  className="text-base font-semibold"
                >
                  {t("syncFinalReviewTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("syncFinalReviewDescription")}
                </p>
              </div>
              <div className="grid overflow-hidden rounded-card border sm:grid-cols-3">
                {(["add", "update", "delete"] as const).map((kind) => (
                  <div
                    key={kind}
                    className="grid gap-1 border-b p-4 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
                  >
                    <span className="text-xs text-muted-foreground">
                      {t(`syncKinds.${kind}`)}
                    </span>
                    <strong className="text-xl tabular-nums">
                      {
                        selectedOperations.filter(
                          (operation) => operation.kind === kind,
                        ).length
                      }
                    </strong>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <section className="grid content-start gap-2 rounded-card border p-4">
                  <h3 className="font-semibold">{t("affectedReferences")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("affectedReferenceSummary", {
                      policies: affectedPolicyIds.length,
                      credentials: affectedCredentialIds.length,
                    })}
                  </p>
                </section>
                <section className="grid content-start gap-2 rounded-card border p-4">
                  <h3 className="font-semibold">
                    {t("notificationRecipients")}
                  </h3>
                  {affectedUserIds.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {backoffice.users
                        .filter((user) => affectedUserIds.includes(user.id))
                        .map((user) => (
                          <Badge key={user.id} variant="outline">
                            {user.nickname}
                          </Badge>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {common("none")}
                    </p>
                  )}
                </section>
              </div>
            </section>
          ) : null}
          <CommandErrorMessage error={error} />
        </CardContent>
        <CardFooter className="justify-between gap-2">
          {step === 2 ? (
            <Button
              variant="outline"
              onClick={() => {
                setStep(1)
                setError(undefined)
              }}
            >
              {common("previous")}
            </Button>
          ) : (
            <span />
          )}
          {step === 1 && !plan ? (
            <Button
              onClick={() => void reviewManifest()}
              disabled={!serviceId || source.trim().length < 2}
            >
              {common("review")}
            </Button>
          ) : step === 1 ? (
            <Button
              onClick={() => {
                setStep(2)
              }}
              disabled={selectedKeys.size === 0}
            >
              {common("next")}
            </Button>
          ) : (
            <Button
              onClick={() => void synchronize()}
              disabled={selectedKeys.size === 0}
            >
              <RefreshCw aria-hidden />
              {t("synchronize")}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
