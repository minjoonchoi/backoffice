"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type {
  BackofficeApiClientFactory,
  BackofficeCommands,
} from "@/application/api/api-client"
import { createBackofficeApiClient } from "@/application/api/client-factory"
import { createBackofficeCommands } from "@/application/state/commands"
import type { CommandResult } from "@/domain/common"
import type { BackofficeState } from "@/application/state/model"
import { useAuditActor } from "@/features/audit/audit-actor-provider"

type BackofficeContextValue = BackofficeState & BackofficeCommands

const BackofficeContext = createContext<BackofficeContextValue | null>(null)

export function BackofficeProvider({
  children,
  initialState,
  apiClientFactory = createBackofficeApiClient,
}: {
  children: ReactNode
  initialState: BackofficeState
  apiClientFactory?: BackofficeApiClientFactory
}) {
  const { getActorUserId } = useAuditActor()
  const [apiClient] = useState(() =>
    apiClientFactory({ initialState, getActorUserId }),
  )
  const [state, setState] = useState<BackofficeState>(() =>
    structuredClone(initialState),
  )

  const refreshState = useCallback(async () => {
    const response = await apiClient.getSnapshot({})
    setState(response.data)
  }, [apiClient])

  const runCommand = useCallback(
    async <Entity,>(request: Promise<CommandResult<Entity>>) => {
      const response = await request
      if (response.ok) await refreshState()
      return response
    },
    [refreshState],
  )

  const commands = useMemo<BackofficeCommands>(
    () => createBackofficeCommands(apiClient, runCommand, getActorUserId),
    [apiClient, getActorUserId, runCommand],
  )

  const value = useMemo<BackofficeContextValue>(
    () => ({ ...state, ...commands }),
    [commands, state],
  )

  return (
    <BackofficeContext.Provider value={value}>
      {children}
    </BackofficeContext.Provider>
  )
}

export function useBackoffice() {
  const context = useContext(BackofficeContext)
  if (!context) {
    throw new Error("useBackoffice must be used within BackofficeProvider")
  }
  return context
}
