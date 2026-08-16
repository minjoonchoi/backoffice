"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, History, ShieldAlert, UsersRound } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { useBackoffice } from "@/application/state/provider"
import { EmptyState } from "@/components/patterns/content-state"
import { DataTable } from "@/components/patterns/data-table"
import { DetailGrid, DetailItem } from "@/components/patterns/detail-grid"
import { MetricCard } from "@/components/patterns/metric-card"
import { PageHeader } from "@/components/patterns/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  auditResourceTypes,
  auditTypeFilterValues,
  auditActionValues,
  type AuditAction,
  type AuditEvent,
  type AuditResourceType,
} from "@/features/audit/model"

type AuditTypeFilter =
  | (typeof auditTypeFilterValues)[keyof typeof auditTypeFilterValues]
  | AuditResourceType

function AuditActionBadge({ action }: { action: AuditAction }) {
  const t = useTranslations("backoffice.audit")
  return (
    <Badge
      variant={
        action === auditActionValues.created
          ? "success"
          : action === auditActionValues.deleted
            ? "destructive"
            : "info"
      }
    >
      {t(`actions.${action}`)}
    </Badge>
  )
}

function useAuditResourceLabel() {
  const t = useTranslations("backoffice.audit.resourceTypes")
  return (type: AuditResourceType) => t(type)
}

function useAuditDateFormatter() {
  const locale = useLocale()
  return useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  )
}

export function AuditLogPage() {
  const backoffice = useBackoffice()
  const t = useTranslations("backoffice.audit")
  const common = useTranslations("backoffice.common")
  const resourceLabel = useAuditResourceLabel()
  const dateFormatter = useAuditDateFormatter()
  const [typeFilter, setTypeFilter] = useState<AuditTypeFilter>(
    auditTypeFilterValues.all,
  )
  const events = useMemo(
    () =>
      backoffice.auditEvents.toSorted((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    [backoffice.auditEvents],
  )
  const filteredEvents = useMemo(
    () =>
      typeFilter === auditTypeFilterValues.all
        ? events
        : events.filter((event) => event.resourceType === typeFilter),
    [events, typeFilter],
  )
  const actorCount = new Set(events.map((event) => event.actorUserId)).size
  const permissionUserCount = new Set(
    events.flatMap((event) => event.impact.permissionChangedUserIds),
  ).size
  const columns = useMemo<ColumnDef<AuditEvent>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: t("occurredAt"),
        size: 170,
        cell: ({ row }) =>
          dateFormatter.format(new Date(row.original.createdAt)),
      },
      {
        accessorKey: "resourceType",
        header: t("resourceType"),
        size: 140,
        cell: ({ row }) => (
          <Badge variant="outline">
            {resourceLabel(row.original.resourceType)}
          </Badge>
        ),
      },
      {
        accessorKey: "action",
        header: t("action"),
        size: 100,
        cell: ({ row }) => <AuditActionBadge action={row.original.action} />,
      },
      {
        accessorKey: "targetName",
        header: t("target"),
        size: 260,
        cell: ({ row }) => (
          <span
            className="block truncate font-medium"
            title={row.original.targetName}
          >
            {row.original.targetName}
          </span>
        ),
      },
      {
        id: "actor",
        header: t("actor"),
        size: 150,
        cell: ({ row }) =>
          backoffice.users.find((user) => user.id === row.original.actorUserId)
            ?.nickname ?? t("systemActor"),
      },
      {
        id: "impact",
        header: t("impact"),
        size: 170,
        cell: ({ row }) => (
          <span className="block truncate text-muted-foreground">
            {t("impactSummary", {
              users: row.original.impact.permissionChangedUserIds.length,
              policies: row.original.impact.relatedPolicyIds.length,
            })}
          </span>
        ),
      },
    ],
    [backoffice.users, dateFormatter, resourceLabel, t],
  )

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          title={t("totalEvents")}
          value={events.length}
          icon={History}
        />
        <MetricCard
          title={t("actorCount")}
          value={actorCount}
          icon={UsersRound}
        />
        <MetricCard
          title={t("permissionImpactUsers")}
          value={permissionUserCount}
          icon={ShieldAlert}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("historyTitle")}</CardTitle>
          <CardDescription>{t("historyDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div
            className="overflow-x-auto"
            role="tablist"
            aria-label={t("typeTabs")}
          >
            <div className="flex min-w-max gap-1 border-b border-border-subtle">
              {(
                [auditTypeFilterValues.all, ...auditResourceTypes] as const
              ).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === type}
                  className="h-control border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none hover:bg-control-hover focus-visible:ring-2 focus-visible:ring-ring aria-selected:border-primary aria-selected:text-foreground"
                  onClick={() => {
                    setTypeFilter(type)
                  }}
                >
                  {type === auditTypeFilterValues.all
                    ? common("all")
                    : resourceLabel(type)}
                </button>
              ))}
            </div>
          </div>
          <div role="tabpanel">
            <DataTable
              caption={t("tableCaption")}
              columns={columns}
              data={filteredEvents}
              getRowId={(event) => event.id}
              getRowHref={(event) => `/audit-logs/${event.id}`}
              getRowLabel={(event) =>
                t("openDetail", { name: event.targetName })
              }
              filters={[
                {
                  id: "target",
                  label: t("target"),
                  getValue: (event) => event.targetName,
                },
                {
                  id: "actor",
                  label: t("actor"),
                  getValue: (event) =>
                    backoffice.users.find(
                      (user) => user.id === event.actorUserId,
                    )?.nickname ?? t("systemActor"),
                },
              ]}
              filterLabel={common("search")}
              empty={
                <EmptyState
                  title={t("empty")}
                  description={t("emptyDescription")}
                />
              }
              noResults={
                <EmptyState
                  title={common("noResults")}
                  description={t("noResultsDescription")}
                />
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function AuditLogDetailPage({ eventId }: { eventId: string }) {
  const backoffice = useBackoffice()
  const t = useTranslations("backoffice.audit")
  const common = useTranslations("backoffice.common")
  const resourceLabel = useAuditResourceLabel()
  const dateFormatter = useAuditDateFormatter()
  const event = backoffice.auditEvents.find(
    (candidate) => candidate.id === eventId,
  )

  if (!event) {
    return (
      <EmptyState
        title={t("notFound")}
        description={t("notFoundDescription")}
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/audit-logs" />}
          >
            {common("backToList")}
          </Button>
        }
      />
    )
  }

  const actor = backoffice.users.find((user) => user.id === event.actorUserId)
  const impactedUsers = backoffice.users.filter((user) =>
    event.impact.permissionChangedUserIds.includes(user.id),
  )
  const policies = backoffice.accessPolicies.filter((policy) =>
    event.impact.relatedPolicyIds.includes(policy.id),
  )

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={event.targetName}
        description={t("detailDescription")}
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/audit-logs" />}
          >
            <ArrowLeft aria-hidden />
            {common("backToList")}
          </Button>
        }
      />
      <DetailGrid>
        <DetailItem label={t("occurredAt")}>
          {dateFormatter.format(new Date(event.createdAt))}
        </DetailItem>
        <DetailItem label={t("actor")}>
          {actor?.nickname ?? t("systemActor")}
        </DetailItem>
        <DetailItem label={t("resourceType")}>
          <Badge variant="outline">{resourceLabel(event.resourceType)}</Badge>
        </DetailItem>
        <DetailItem label={t("action")}>
          <AuditActionBadge action={event.action} />
        </DetailItem>
        <DetailItem
          label={t("targetId")}
          className="sm:col-span-2 sm:border-r-0"
        >
          <code className="text-xs break-all">{event.targetId}</code>
        </DetailItem>
      </DetailGrid>
      <Card>
        <CardHeader>
          <CardTitle>{t("changesTitle")}</CardTitle>
          <CardDescription>{t("changesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid divide-y rounded-card border">
            {event.changes.map((change) => (
              <li
                key={change.field}
                className="grid gap-2 p-3 md:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)]"
              >
                <code className="text-xs font-semibold">{change.field}</code>
                <span className="min-w-0 text-sm break-words text-muted-foreground">
                  {change.before ?? common("none")}
                </span>
                <span className="min-w-0 text-sm break-words">
                  {change.after ?? common("none")}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("impactTitle")}</CardTitle>
          <CardDescription>{t("impactDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">
              {t("gained", { count: event.impact.gainedPermissionCount })}
            </Badge>
            <Badge variant="destructive">
              {t("lost", { count: event.impact.lostPermissionCount })}
            </Badge>
            <Badge variant="secondary">
              {t("relatedPolicies", { count: policies.length })}
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <section className="grid content-start gap-2 rounded-card border p-3">
              <h2 className="font-semibold">{t("impactedUsers")}</h2>
              {impactedUsers.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {impactedUsers.map((user) => (
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
            <section className="grid content-start gap-2 rounded-card border p-3">
              <h2 className="font-semibold">{t("relatedPolicyList")}</h2>
              {policies.length ? (
                <ul className="grid gap-1 text-sm">
                  {policies.map((policy) => (
                    <li key={policy.id}>{policy.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {common("none")}
                </p>
              )}
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
