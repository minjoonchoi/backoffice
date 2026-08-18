import type { BackofficeState } from "@/application/state/model"
import { entityStatuses } from "@/domain/common"

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
  status: typeof entityStatuses.active
  createdAt: string
} {
  return { ...createRecordBase(), status: entityStatuses.active }
}
