"use client"

import { useBackoffice } from "@/application/state/provider"
import { useSessionAccess } from "@/auth/session-access-provider"
import { resolveServiceResourceAccess } from "@/auth/service-resource-access"

export function useServiceResourceAccess() {
  const backoffice = useBackoffice()
  const sessionAccess = useSessionAccess()
  return resolveServiceResourceAccess(
    backoffice,
    sessionAccess.currentUser?.id ?? null,
  )
}
