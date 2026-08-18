"use client"

import Link from "next/link"
import type { ComponentProps } from "react"

import { useSessionAccess } from "@/auth/session-access-provider"
import type { BackofficeUiResourceKey } from "@/config/menu-registry"
import { cn } from "@/lib/utils"

type UiResourceLinkProps = ComponentProps<typeof Link> & {
  resourceKey: BackofficeUiResourceKey
}

export function UiResourceLink({
  resourceKey,
  className,
  children,
  id,
  ...props
}: UiResourceLinkProps) {
  const canAccess = useSessionAccess().canAccessUiResource(resourceKey)

  if (!canAccess) return <span id={id}>{children}</span>

  return (
    <Link
      className={cn("text-primary hover:underline", className)}
      id={id}
      {...props}
    >
      {children}
    </Link>
  )
}
