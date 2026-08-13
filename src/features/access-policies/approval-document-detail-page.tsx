"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

import { UiResourceLink } from "@/auth/ui-resource-link"
import { EmptyState } from "@/components/patterns/content-state"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import { PageHeader } from "@/components/patterns/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { uiResourceKeys } from "@/config/menu-registry"
import { useBackoffice } from "@/application/state/provider"
import {
  ApprovalStatusBadge,
  useBackofficeLabels,
} from "@/application/ui/backoffice-ui"

export function ApprovalDocumentDetailPage({
  requestId,
}: {
  requestId: string
}) {
  const backoffice = useBackoffice()
  const common = useTranslations("backoffice.common")
  const t = useTranslations("backoffice.approvalDocuments")
  const labels = useBackofficeLabels()
  const document = backoffice.approvalDocuments.find(
    (candidate) => candidate.id === requestId,
  )
  if (!document) {
    return (
      <EmptyState
        title={t("requestDetailTitle")}
        description={t("requestNotFound")}
        action={
          <Button render={<Link href="/approval-documents" />}>
            {common("backToList")}
          </Button>
        }
      />
    )
  }

  const requester = backoffice.users.find(
    (candidate) => candidate.id === document.requesterId,
  )
  const organization = backoffice.organizations.find(
    (candidate) => candidate.id === document.organizationId,
  )
  const template = backoffice.approvalLines.find(
    (candidate) => candidate.id === document.approvalLineId,
  )
  if (!requester || !organization || !template) {
    throw new Error(`Request reference not found: ${document.id}`)
  }

  const relatedTarget =
    document.documentKind === "general" && document.type === "access-grant"
      ? backoffice.accessPolicies.find(
          (policy) => policy.id === document.accessPolicyId,
        )
      : document.documentKind === "api-key-issuance"
        ? backoffice.services.find(
            (service) => service.id === document.serviceId,
          )
        : document.documentKind === "api-key-lifecycle"
          ? backoffice.apiKeys.find((apiKey) => apiKey.id === document.apiKeyId)
          : null

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("requestDetailEyebrow")}
        title={document.title}
        description={t("requestDetailDescription")}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("requestSummary")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailItem label={t("requestType")}>
              {labels.approvalType(document.type)}
            </DetailItem>
            <DetailItem label={common("status")}>
              <ApprovalStatusBadge status={document.status} />
            </DetailItem>
            <DetailItem label={t("requester")}>
              <UiResourceLink
                resourceKey={uiResourceKeys.users.detail.key}
                href={`/users/${requester.id}`}
              >
                {requester.nickname}
              </UiResourceLink>
            </DetailItem>
            <DetailItem label={t("requestOrganization")}>
              <UiResourceLink
                resourceKey={uiResourceKeys.organizations.detail.key}
                href={`/organizations/${organization.id}`}
              >
                {organization.name}
              </UiResourceLink>
            </DetailItem>
            <DetailItem label={t("approvalLine")}>{template.name}</DetailItem>
            <DetailItem label={common("createdAt")}>
              {labels.dateTime(document.createdAt)}
            </DetailItem>
            {relatedTarget ? (
              <DetailItem label={t("requestTarget")}>
                {relatedTarget.name}
              </DetailItem>
            ) : null}
            <DetailItem label={t("requestContent")} className="sm:col-span-2">
              <span className="whitespace-pre-wrap">{document.content}</span>
            </DetailItem>
          </DetailGrid>
        </CardContent>
      </Card>
      {document.fieldValues.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("requestInputValues")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid>
              {document.fieldValues.map((fieldValue) => {
                const field = template.fields.find(
                  (candidate) => candidate.id === fieldValue.fieldId,
                )
                if (!field) {
                  throw new Error(
                    `Request field not found: ${fieldValue.fieldId}`,
                  )
                }
                return (
                  <DetailItem key={fieldValue.fieldId} label={field.label}>
                    <span className="break-words whitespace-pre-wrap">
                      {fieldValue.value}
                    </span>
                  </DetailItem>
                )
              })}
            </DetailGrid>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{t("approvalFlow")}</CardTitle>
          <CardDescription>{t("approvalFlowDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2">
            {document.approvalSteps.map((step) => {
              const assignee =
                step.assigneeType === "user"
                  ? backoffice.users.find((user) => user.id === step.assigneeId)
                      ?.nickname
                  : backoffice.organizations.find(
                      (item) => item.id === step.assigneeId,
                    )?.name
              if (!assignee)
                throw new Error(`Request assignee not found: ${step.id}`)
              return (
                <li
                  key={step.id}
                  className="grid gap-1 rounded-card border border-border-subtle p-3 sm:grid-cols-[5rem_1fr_auto] sm:items-center"
                >
                  <span className="text-xs font-medium text-text-subtle">
                    {t("approvalStage", { stage: step.stage })}
                  </span>
                  <span className="font-medium">{assignee}</span>
                  <span className="text-sm text-muted-foreground">
                    {labels.stepKind(step.kind)}
                  </span>
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
