import "server-only"

import { cookies } from "next/headers"
import { connection } from "next/server"
import { cache } from "react"
import { z } from "zod"

import { localSessionUserCookie } from "@/auth/local-session-cookie"
import { getAuthPort } from "@/auth/ports"
import { resolveUiResourcePolicyAccess } from "@/auth/ui-resource-policy-access"
import type { BackofficeUiResourceKey } from "@/config/menu-registry"
import {
  localBackofficeDataSource,
  createBackofficeQueryClient,
} from "@/application/bootstrap/initial-state"

export const getBackofficeServerAccess = cache(async () => {
  await connection()
  const viewer = await getAuthPort().getCurrentViewer()
  const queryClient = await createBackofficeQueryClient(
    process.env.NODE_ENV,
    process.env.BACKOFFICE_DATA_SOURCE,
  )
  const [{ data: backoffice }, localSessionSeed] = await Promise.all([
    queryClient.getSnapshot({}),
    queryClient.getLocalSessionSeed(),
  ])
  const localSessionEnabled =
    process.env.NODE_ENV === "development" &&
    process.env.BACKOFFICE_DATA_SOURCE === localBackofficeDataSource &&
    localSessionSeed !== null
  const localSessionCookie = localSessionEnabled
    ? (await cookies()).get(localSessionUserCookie)?.value
    : undefined
  const parsedLocalSessionUserId = z.uuid().safeParse(localSessionCookie)
  const localSessionUserId =
    localSessionCookie === undefined
      ? (localSessionSeed?.defaultUserId ?? null)
      : parsedLocalSessionUserId.success &&
          backoffice.users.some(
            (user) => user.id === parsedLocalSessionUserId.data,
          )
        ? parsedLocalSessionUserId.data
        : null
  const userId = localSessionEnabled ? localSessionUserId : (viewer?.id ?? null)
  const access = userId
    ? resolveUiResourcePolicyAccess(backoffice, userId)
    : { roleIds: [], resourceKeys: [], grants: [] }

  return {
    viewer,
    backoffice,
    localSessionEnabled,
    userId,
    access,
  }
})

export async function canServerAccessUiResource(
  resourceKey: BackofficeUiResourceKey,
) {
  const { access } = await getBackofficeServerAccess()
  return access.resourceKeys.includes(resourceKey)
}
