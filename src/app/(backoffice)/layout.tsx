import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"

import { SessionAccessProvider } from "@/auth/session-access-provider"
import { getBackofficeServerAccess } from "@/auth/server-ui-resource-access"
import { ShellFrame } from "@/components/shell/shell-frame"
import { BackofficeProvider } from "@/application/state/provider"
import { AuditActorProvider } from "@/features/audit/audit-actor-provider"

export default async function BackofficeLayout({
  children,
}: {
  children: ReactNode
}) {
  const [t, serverAccess] = await Promise.all([
    getTranslations("shell"),
    getBackofficeServerAccess(),
  ])

  return (
    <AuditActorProvider initialActorUserId={serverAccess.userId}>
      <BackofficeProvider initialState={serverAccess.backoffice}>
        <SessionAccessProvider
          localSwitchingEnabled={serverAccess.localSessionEnabled}
          {...(serverAccess.userId
            ? { initialUserId: serverAccess.userId }
            : {})}
        >
          <ShellFrame
            displayName={serverAccess.viewer?.displayName ?? "Backoffice"}
            labels={{
              skipToContent: t("skipToContent"),
              home: t("home"),
              toggleSidebar: t("toggleSidebar"),
              resizeSidebar: t("resizeSidebar"),
              language: t("language"),
              localeLabels: {
                ko: t("korean"),
                en: t("english"),
              },
              userMenu: t("userMenu"),
              authStatus: t("authPending"),
              permissionStatus: t("noPermissions"),
              directory: t("directory"),
              systemManagement: t("systemManagement"),
              serviceCatalog: t("serviceCatalog"),
              uiCatalog: t("uiCatalog"),
              users: t("users"),
              organizations: t("organizations"),
              roles: t("roles"),
              applications: t("applications"),
              namespaces: t("namespaces"),
              requests: t("requests"),
              approvalLines: t("approvalLines"),
              approvalDocuments: t("approvalDocuments"),
              services: t("services"),
              serviceEndpoints: t("serviceEndpoints"),
              apiKeys: t("apiKeys"),
              uiResources: t("uiResources"),
              auditLogs: t("auditLogs"),
              sessionAccess: t("sessionAccess"),
              localCurrentUser: t("localCurrentUser"),
              localAuthStatus: t("localAuthStatus"),
              organizationCount: t("organizationCount"),
              roleCount: t("roleCount"),
              emptyMemberships: t("emptyMemberships"),
              accessibleMenuCount: t("accessibleMenuCount"),
              accessDeniedTitle: t("accessDeniedTitle"),
              accessDeniedDescription: t("accessDeniedDescription"),
              goToAccessibleMenu: t("goToAccessibleMenu"),
            }}
          >
            {children}
          </ShellFrame>
        </SessionAccessProvider>
      </BackofficeProvider>
    </AuditActorProvider>
  )
}
