import type { BackofficeState } from "@/application/state/model"

export type BackofficeStateUpdater = (
  update: (current: BackofficeState) => BackofficeState,
) => void

export function createRecordBase(): { id: string; createdAt: string } {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
}

export function createEntityBase(): {
  id: string
  status: "active"
  createdAt: string
} {
  return { ...createRecordBase(), status: "active" }
}
