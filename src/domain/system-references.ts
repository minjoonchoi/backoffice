import { z } from "zod"

export const backofficeSystemReferencesSchema = z.object({
  roleIds: z.object({
    administrator: z.uuid(),
    policyOperator: z.uuid(),
    iamOperator: z.uuid(),
    generalUser: z.uuid(),
    uiResourceManager: z.uuid(),
    serviceOperator: z.uuid(),
  }),
  namespaceIds: z.object({
    backoffice: z.uuid(),
  }),
  serviceEndpointIds: z.object({
    importUiResources: z.uuid(),
  }),
})

export type BackofficeSystemReferences = Readonly<
  z.infer<typeof backofficeSystemReferencesSchema>
>

export function isSystemManagedRole(
  references: BackofficeSystemReferences,
  roleId: string,
): boolean {
  return (
    roleId === references.roleIds.generalUser ||
    roleId === references.roleIds.serviceOperator
  )
}

export function isSystemRole(
  references: BackofficeSystemReferences,
  roleId: string,
): boolean {
  return Object.values(references.roleIds).includes(roleId)
}
