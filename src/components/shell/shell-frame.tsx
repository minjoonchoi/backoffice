"use client"

import {
  Building2,
  ChevronRight,
  FilePlus2,
  GitBranch,
  House,
  KeyRound,
  PanelsTopLeft,
  Network,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  ShieldX,
  SquareDashedMousePointer,
  Users,
  UserRoundCog,
  X,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, type CSSProperties, type ReactNode } from "react"

import { LanguageSwitcher } from "@/components/shell/language-switcher"
import { UserMenu } from "@/components/shell/user-menu"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ResultSection,
  ResultSectionActions,
  ResultSectionDescription,
  ResultSectionHeader,
  ResultSectionMedia,
  ResultSectionTitle,
} from "@/components/ui/result-section"
import { useSessionAccess } from "@/auth/session-access-provider"
import { localSessionUserCookie } from "@/auth/local-session-cookie"
import {
  menuDefinitions,
  type MenuKey,
  type MenuSection,
} from "@/config/menu-registry"
import type { Locale } from "@/i18n/config"
import { cn } from "@/lib/utils"

export type ShellLabels = {
  skipToContent: string
  home: string
  toggleSidebar: string
  resizeSidebar: string
  language: string
  localeLabels: Record<Locale, string>
  userMenu: string
  authStatus: string
  permissionStatus: string
  directory: string
  systemManagement: string
  serviceCatalog: string
  uiCatalog: string
  users: string
  organizations: string
  roles: string
  groups: string
  namespaces: string
  approvalLines: string
  approvalDocuments: string
  services: string
  serviceEndpoints: string
  apiKeys: string
  uiResources: string
  sessionAccess: string
  localCurrentUser: string
  localAuthStatus: string
  organizationCount: string
  roleCount: string
  groupCount: string
  emptyMemberships: string
  accessibleMenuCount: string
  accessDeniedTitle: string
  accessDeniedDescription: string
  goToAccessibleMenu: string
}

export type ShellFrameProps = {
  children: ReactNode
  labels: ShellLabels
  displayName: string
}

const SIDEBAR_MIN_WIDTH = 72
const SIDEBAR_DEFAULT_WIDTH = 256
const SIDEBAR_MAX_WIDTH = 320

type ShellFrameStyle = CSSProperties & {
  "--sidebar-width": string
}

function MembershipCount({
  icon: Icon,
  label,
  names,
  emptyLabel,
}: {
  icon: LucideIcon
  label: string
  names: readonly string[]
  emptyLabel: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-xs font-medium outline-none hover:bg-control-hover focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label={`${label}: ${String(names.length)}`}
          />
        }
      >
        <Icon className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="hidden 2xl:inline">{label}</span>
        <span className="tabular-nums">{names.length}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="px-3 py-2">
        <p className="font-semibold">{label}</p>
        {names.length > 0 ? (
          <ul className="mt-1 grid gap-0.5">
            {names.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-primary-foreground/75">{emptyLabel}</p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

export function ShellFrame({ children, labels, displayName }: ShellFrameProps) {
  const pathname = usePathname()
  const router = useRouter()
  const sessionAccess = useSessionAccess()
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH)
  const [expandedSidebarWidth, setExpandedSidebarWidth] = useState(
    SIDEBAR_DEFAULT_WIDTH,
  )
  const [resizingSidebar, setResizingSidebar] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const collapsed = sidebarWidth === SIDEBAR_MIN_WIDTH
  const shellStyle: ShellFrameStyle = {
    "--sidebar-width": `${String(sidebarWidth)}px`,
  }

  function resizeSidebar(nextWidth: number) {
    const width = Math.min(
      SIDEBAR_MAX_WIDTH,
      Math.max(SIDEBAR_MIN_WIDTH, nextWidth),
    )
    setSidebarWidth(width)
    if (width > SIDEBAR_MIN_WIDTH) setExpandedSidebarWidth(width)
  }
  const menuLabels: Record<MenuKey, string> = {
    home: labels.home,
    users: labels.users,
    organizations: labels.organizations,
    roles: labels.roles,
    groups: labels.groups,
    namespaces: labels.namespaces,
    approvalLines: labels.approvalLines,
    approvalDocuments: labels.approvalDocuments,
    services: labels.services,
    serviceEndpoints: labels.serviceEndpoints,
    apiKeys: labels.apiKeys,
    uiResources: labels.uiResources,
  }
  const menuIcons: Record<MenuKey, LucideIcon> = {
    home: House,
    users: Users,
    organizations: Building2,
    roles: ShieldCheck,
    groups: UserRoundCog,
    namespaces: PanelsTopLeft,
    approvalLines: GitBranch,
    approvalDocuments: FilePlus2,
    services: PackageSearch,
    serviceEndpoints: Network,
    apiKeys: KeyRound,
    uiResources: SquareDashedMousePointer,
  }
  const sectionLabels: Record<Exclude<MenuSection, "common">, string> = {
    directory: labels.directory,
    serviceCatalog: labels.serviceCatalog,
    uiCatalog: labels.uiCatalog,
    systemManagement: labels.systemManagement,
  }
  const sectionOrder: Exclude<MenuSection, "common">[] = [
    "directory",
    "serviceCatalog",
    "uiCatalog",
    "systemManagement",
  ]
  const accessibleMenuIds = new Set(sessionAccess.accessibleMenuIds)
  const visibleMenuDefinitions = menuDefinitions.filter((item) =>
    accessibleMenuIds.has(item.id),
  )
  const standaloneMenuDefinitions = visibleMenuDefinitions.filter(
    (item) => item.section === "common",
  )
  const navigationSections = sectionOrder
    .map((section) => ({
      id: section,
      label: sectionLabels[section],
      items: visibleMenuDefinitions.filter((item) => item.section === section),
    }))
    .filter((section) => section.items.length > 0)
  const currentItem = menuDefinitions.find(
    (item) =>
      pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(`${item.href}/`)),
  )
  const currentLabel = currentItem ? menuLabels[currentItem.id] : labels.home
  const currentAccessAllowed =
    !currentItem || accessibleMenuIds.has(currentItem.id)
  const firstAccessibleItem = visibleMenuDefinitions[0]
  const homeHref = firstAccessibleItem?.href ?? "/"
  const resolvedDisplayName = sessionAccess.currentUser?.nickname ?? displayName
  return (
    <div
      data-app-shell
      ref={(node) => {
        if (node) node.dataset.hydrated = "true"
      }}
      className={cn(
        "min-h-svh bg-muted/30 lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]",
        !resizingSidebar && "lg:transition-[grid-template-columns]",
      )}
      style={shellStyle}
    >
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-[70] -translate-y-20 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0 focus:ring-3 focus:ring-ring/50 focus:outline-none"
      >
        {labels.skipToContent}
      </a>

      {mobileOpen ? (
        <button
          type="button"
          aria-label={labels.toggleSidebar}
          className="fixed inset-0 z-30 bg-foreground/10 lg:hidden"
          onClick={() => {
            setMobileOpen(false)
          }}
        />
      ) : null}

      <aside
        id="app-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-background transition-transform lg:sticky lg:top-0 lg:h-svh lg:w-[var(--sidebar-width)] lg:translate-x-0",
          !resizingSidebar && "lg:transition-[width,transform]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link
            href={homeHref}
            className="flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => {
              setMobileOpen(false)
            }}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
              B
            </span>
            <span
              className={cn("truncate font-semibold", collapsed && "lg:hidden")}
            >
              Backoffice
            </span>
          </Link>
          <Button
            className="lg:hidden"
            variant="ghost"
            size="icon-sm"
            aria-label={labels.toggleSidebar}
            onClick={() => {
              setMobileOpen(false)
            }}
          >
            <X aria-hidden />
          </Button>
        </div>

        <nav
          aria-label={labels.home}
          className="flex-1 space-y-4 overflow-y-auto p-3"
        >
          {standaloneMenuDefinitions.length ? (
            <div className="grid gap-1">
              {standaloneMenuDefinitions.map((item) => {
                const Icon = menuIcons[item.id]
                const selected =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(`${item.href}/`))
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-3 overflow-hidden rounded-lg px-3 text-sm font-medium outline-none hover:bg-control-hover focus-visible:ring-3 focus-visible:ring-ring/50",
                      selected &&
                        "bg-brand-weak text-brand-weak-foreground hover:bg-brand-weak",
                      collapsed && "lg:justify-center lg:px-0",
                    )}
                    onClick={() => {
                      setMobileOpen(false)
                    }}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span
                      className={cn(
                        "whitespace-nowrap",
                        collapsed && "lg:sr-only",
                      )}
                    >
                      {menuLabels[item.id]}
                    </span>
                  </Link>
                )
              })}
            </div>
          ) : null}
          {navigationSections.map((section) => (
            <div key={section.id} className="grid gap-1">
              <p
                className={cn(
                  "px-3 pb-1 text-[0.6875rem] font-semibold tracking-[0.08em] text-text-disabled uppercase",
                  collapsed && "lg:sr-only",
                )}
              >
                {section.label}
              </p>
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                const Icon = menuIcons[item.id]
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-3 overflow-hidden rounded-lg px-3 text-sm font-medium text-text-subtle outline-none hover:bg-control-hover hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                      active &&
                        "bg-brand-weak text-brand-weak-foreground hover:bg-brand-weak",
                      collapsed && "lg:justify-center lg:px-0",
                    )}
                    onClick={() => {
                      setMobileOpen(false)
                    }}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span
                      className={cn(
                        "whitespace-nowrap",
                        collapsed && "lg:sr-only",
                      )}
                    >
                      {menuLabels[item.id]}
                    </span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        <div
          role="separator"
          aria-label={labels.resizeSidebar}
          aria-orientation="vertical"
          aria-valuemin={SIDEBAR_MIN_WIDTH}
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          aria-valuenow={sidebarWidth}
          aria-valuetext={`${String(sidebarWidth)}px`}
          tabIndex={0}
          className="absolute inset-y-0 -right-1 z-50 hidden w-2 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 hover:after:bg-primary focus-visible:after:w-0.5 focus-visible:after:bg-primary lg:block"
          onDoubleClick={() => {
            resizeSidebar(SIDEBAR_DEFAULT_WIDTH)
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            setResizingSidebar(true)
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
            resizeSidebar(event.clientX)
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
            setResizingSidebar(false)
          }}
          onPointerCancel={() => {
            setResizingSidebar(false)
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault()
              resizeSidebar(sidebarWidth - 16)
            } else if (event.key === "ArrowRight") {
              event.preventDefault()
              resizeSidebar(sidebarWidth + 16)
            } else if (event.key === "Home") {
              event.preventDefault()
              resizeSidebar(SIDEBAR_MIN_WIDTH)
            } else if (event.key === "End") {
              event.preventDefault()
              resizeSidebar(SIDEBAR_MAX_WIDTH)
            }
          }}
        />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              className="lg:hidden"
              variant="ghost"
              size="icon"
              aria-label={labels.toggleSidebar}
              aria-controls="app-sidebar"
              aria-expanded={mobileOpen}
              onClick={() => {
                setMobileOpen(true)
              }}
            >
              <PanelLeftOpen aria-hidden />
            </Button>
            <Button
              className="hidden lg:inline-flex"
              variant="ghost"
              size="icon"
              aria-label={labels.toggleSidebar}
              aria-controls="app-sidebar"
              aria-expanded={!collapsed}
              onClick={() => {
                resizeSidebar(
                  collapsed ? expandedSidebarWidth : SIDEBAR_MIN_WIDTH,
                )
              }}
            >
              {collapsed ? (
                <PanelLeftOpen aria-hidden />
              ) : (
                <PanelLeftClose aria-hidden />
              )}
            </Button>
            <nav
              aria-label="Breadcrumb"
              className="flex min-w-0 items-center gap-1 text-sm"
            >
              <Link
                href={homeHref}
                className="truncate rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Backoffice
              </Link>
              <ChevronRight
                className="size-3.5 text-muted-foreground"
                aria-hidden
              />
              <span aria-current="page" className="truncate font-medium">
                {currentLabel}
              </span>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {sessionAccess.currentUser ? (
              <TooltipProvider delay={200}>
                <div
                  className="flex items-center gap-1"
                  aria-label={labels.localCurrentUser}
                >
                  <MembershipCount
                    icon={Building2}
                    label={labels.organizationCount}
                    names={sessionAccess.organizationNames}
                    emptyLabel={labels.emptyMemberships}
                  />
                  <MembershipCount
                    icon={ShieldCheck}
                    label={labels.roleCount}
                    names={sessionAccess.effectiveRoles.map(
                      (role) => role.name,
                    )}
                    emptyLabel={labels.emptyMemberships}
                  />
                  <MembershipCount
                    icon={UserRoundCog}
                    label={labels.groupCount}
                    names={sessionAccess.groupNames}
                    emptyLabel={labels.emptyMemberships}
                  />
                </div>
              </TooltipProvider>
            ) : null}
            <LanguageSwitcher
              label={labels.language}
              localeLabels={labels.localeLabels}
            />
            <UserMenu
              displayName={resolvedDisplayName}
              menuLabel={labels.userMenu}
              authStatus={
                sessionAccess.localSwitchingEnabled
                  ? labels.localAuthStatus
                  : labels.authStatus
              }
              permissionStatus={labels.permissionStatus}
              {...(sessionAccess.localSwitchingEnabled &&
              sessionAccess.currentUser
                ? {
                    sessionAccess: {
                      label: labels.sessionAccess,
                      currentUserLabel: labels.localCurrentUser,
                      currentUserId: sessionAccess.currentUser.id,
                      users: sessionAccess.userOptions,
                      organizationCountLabel: labels.organizationCount,
                      organizationCount: sessionAccess.organizationNames.length,
                      roleCountLabel: labels.roleCount,
                      roleCount: sessionAccess.effectiveRoles.length,
                      menuCountLabel: labels.accessibleMenuCount,
                      menuCount: sessionAccess.accessibleMenuIds.length,
                      onUserChange: (userId) => {
                        if (!sessionAccess.switchUser(userId)) return
                        document.cookie = `${localSessionUserCookie}=${encodeURIComponent(userId)}; Path=/; SameSite=Lax`
                        router.refresh()
                      },
                    },
                  }
                : {})}
            />
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="p-4 outline-none sm:p-6 lg:p-8"
        >
          <div className="mx-auto w-full max-w-6xl">
            {currentAccessAllowed ? (
              children
            ) : (
              <ResultSection
                role="alert"
                className="min-h-72 rounded-card border bg-card"
              >
                <ResultSectionMedia className="bg-destructive text-destructive-foreground">
                  <ShieldX aria-hidden />
                </ResultSectionMedia>
                <ResultSectionHeader>
                  <ResultSectionTitle>
                    {labels.accessDeniedTitle}
                  </ResultSectionTitle>
                  <ResultSectionDescription>
                    {labels.accessDeniedDescription}
                  </ResultSectionDescription>
                </ResultSectionHeader>
                {firstAccessibleItem ? (
                  <ResultSectionActions>
                    <Button
                      nativeButton={false}
                      render={<Link href={firstAccessibleItem.href} />}
                    >
                      {labels.goToAccessibleMenu}
                    </Button>
                  </ResultSectionActions>
                ) : null}
              </ResultSection>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
