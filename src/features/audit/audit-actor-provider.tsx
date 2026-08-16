"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react"

type AuditActorContextValue = Readonly<{
  getActorUserId: () => string | null
  setActorUserId: (userId: string | null) => void
}>

const AuditActorContext = createContext<AuditActorContextValue>({
  getActorUserId: () => null,
  setActorUserId: () => undefined,
})

export function AuditActorProvider({
  children,
  initialActorUserId,
}: {
  children: ReactNode
  initialActorUserId: string | null
}) {
  const actorUserIdRef = useRef(initialActorUserId)
  const getActorUserId = useCallback(() => actorUserIdRef.current, [])
  const setActorUserId = useCallback((userId: string | null) => {
    actorUserIdRef.current = userId
  }, [])
  const value = useMemo(
    () => ({ getActorUserId, setActorUserId }),
    [getActorUserId, setActorUserId],
  )

  return (
    <AuditActorContext.Provider value={value}>
      {children}
    </AuditActorContext.Provider>
  )
}

export function useAuditActor() {
  return useContext(AuditActorContext)
}
