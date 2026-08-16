import { z } from "zod"

import { entityIdSchema, type EntityStatus } from "@/domain/common"
import {
  namespaceKeySchema,
  uiResourceManifestSchema,
  type UiResourceManifestResource,
  type UiResourceType,
} from "@/features/ui-resources/ui-resource-manifest"

export const namespaceInputSchema = z
  .object({
    key: namespaceKeySchema,
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().min(2).max(500),
    managerRoleId: entityIdSchema,
  })
  .strict()

export const uiResourceImportInputSchema = z
  .object({
    manifest: uiResourceManifestSchema,
    grantManagerAccess: z.boolean(),
  })
  .strict()

export type NamespaceInput = z.infer<typeof namespaceInputSchema>
export type UiResourceImportInput = z.infer<typeof uiResourceImportInputSchema>
export type Namespace = NamespaceInput & {
  id: string
  managerAccessPolicyId: string
  status: EntityStatus
  lastSyncedAt: string | null
  createdAt: string
}
export type UiResource = UiResourceManifestResource & {
  id: string
  namespaceId: string
  status: EntityStatus
  orphanedAt: string | null
  createdAt: string
}
export type UiResourceImportResult = {
  namespaceId: string
  synchronizedAt: string
  addedCount: number
  updatedCount: number
  restoredCount: number
  orphanedCount: number
  managerAccessUpdated: boolean
  resources: UiResource[]
  orphanedResources: UiResource[]
}

export type UiResourceSyncHistory = {
  id: string
  namespaceId: string
  synchronizedAt: string
  synchronizedByUserId: string
  grantManagerAccess: boolean
  addedCount: number
  updatedCount: number
  restoredCount: number
  orphanedCount: number
  resources: UiResource[]
}

export type UiResourceRestoreResult = UiResourceImportResult & {
  restoredFromHistoryId: string
}

export type { UiResourceType }
