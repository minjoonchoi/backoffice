"use client"

import { Check, CircleUserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type UserMenuProps = {
  displayName: string
  menuLabel: string
  authStatus: string
  permissionStatus: string
  sessionAccess?: {
    label: string
    currentUserLabel: string
    currentUserId: string
    users: readonly {
      id: string
      displayName: string
      organizationNames: readonly string[]
    }[]
    organizationCountLabel: string
    organizationCount: number
    roleCountLabel: string
    roleCount: number
    menuCountLabel: string
    menuCount: number
    onUserChange: (userId: string) => void
  }
}

export function UserMenu({
  displayName,
  menuLabel,
  authStatus,
  permissionStatus,
  sessionAccess,
}: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={menuLabel}
        render={<Button variant="ghost" className="max-w-48 gap-2 px-2" />}
      >
        <CircleUserRound className="size-4" aria-hidden />
        <span className="hidden truncate sm:inline">{displayName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className={sessionAccess ? "max-h-96 w-64 overflow-y-auto" : undefined}
      >
        {sessionAccess ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>{sessionAccess.label}</DropdownMenuLabel>
              {sessionAccess.users.map((user) => {
                const selected = user.id === sessionAccess.currentUserId
                return (
                  <DropdownMenuItem
                    key={user.id}
                    aria-label={user.displayName}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => {
                      sessionAccess.onUserChange(user.id)
                    }}
                  >
                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate">{user.displayName}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user.organizationNames.join(", ")}
                      </span>
                    </span>
                    {selected ? (
                      <>
                        <span className="sr-only">
                          {sessionAccess.currentUserLabel}
                        </span>
                        <Check className="ml-auto size-4" aria-hidden />
                      </>
                    ) : null}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled>{authStatus}</DropdownMenuItem>
              <DropdownMenuItem disabled>
                {sessionAccess.organizationCountLabel}:{" "}
                {sessionAccess.organizationCount}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                {sessionAccess.roleCountLabel}: {sessionAccess.roleCount}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                {sessionAccess.menuCountLabel}: {sessionAccess.menuCount}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : (
          <DropdownMenuGroup>
            <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>{authStatus}</DropdownMenuItem>
            <DropdownMenuItem disabled>{permissionStatus}</DropdownMenuItem>
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
