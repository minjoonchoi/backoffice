import "server-only"

import { forbidden } from "next/navigation"
import type { ReactNode } from "react"

import { canServerAccessUiResource } from "@/auth/server-ui-resource-access"
import type { BackofficeUiResourceKey } from "@/config/menu-registry"

export async function UiResourceServerGate({
  resourceKey,
  children,
}: {
  resourceKey: BackofficeUiResourceKey
  children: ReactNode
}) {
  if (!(await canServerAccessUiResource(resourceKey))) forbidden()
  return children
}
