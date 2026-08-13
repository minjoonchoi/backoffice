import { z } from "zod"

import { entityIdSchema, type EntityStatus } from "@/domain/common"
import {
  uiNamespaceKeySchema,
  uiResourceManifestSchema,
  type UiResourceManifestResource,
  type UiResourceType,
} from "@/features/ui-resources/ui-resource-manifest"

export const uiNamespaceInputSchema = z
  .object({
    key: uiNamespaceKeySchema,
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().min(2).max(500),
    administratorRoleId: entityIdSchema,
  })
  .strict()

export const uiResourceImportInputSchema = z
  .object({
    manifest: uiResourceManifestSchema,
    grantAdministratorAccess: z.boolean(),
  })
  .strict()

export type UiNamespaceInput = z.infer<typeof uiNamespaceInputSchema>
export type UiResourceImportInput = z.infer<typeof uiResourceImportInputSchema>
export type UiNamespace = UiNamespaceInput & {
  id: string
  administratorAccessPolicyId: string
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
  orphanedCount: number
  administratorAccessUpdated: boolean
  resources: UiResource[]
  orphanedResources: UiResource[]
}

export type { UiResourceType }
