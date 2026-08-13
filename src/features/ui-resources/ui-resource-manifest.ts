import { parseDocument } from "yaml"
import { z } from "zod"

export const uiResourceKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(
    /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*(?::[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*)*$/,
  )

export const uiNamespaceKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/)

export const uiResourceTypeSchema = z.enum([
  "menu",
  "view",
  "action",
  "component",
])

export const uiResourceManifestResourceSchema = z
  .object({
    key: uiResourceKeySchema,
    parentKey: uiResourceKeySchema.nullable(),
    type: uiResourceTypeSchema,
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(500),
  })
  .strict()

export const uiResourceManifestSchema = z
  .object({
    version: z.literal(1),
    namespaceKey: uiNamespaceKeySchema,
    resources: z.array(uiResourceManifestResourceSchema).min(1).max(1000),
  })
  .strict()
  .refine(
    (manifest) =>
      new Set(manifest.resources.map((resource) => resource.key)).size ===
      manifest.resources.length,
    { path: ["resources"] },
  )

export type UiResourceType = z.infer<typeof uiResourceTypeSchema>
export type UiResourceManifest = z.infer<typeof uiResourceManifestSchema>
export type UiResourceManifestResource = z.infer<
  typeof uiResourceManifestResourceSchema
>
export type UiResourceManifestFormat = "yaml" | "json"

export function getUiResourceParentKey(key: string): string | null {
  const separatorIndex = key.lastIndexOf(":")
  return separatorIndex === -1 ? null : key.slice(0, separatorIndex)
}

export function parseUiResourceManifestText(
  source: string,
  format: UiResourceManifestFormat,
): unknown {
  if (format === "json") return JSON.parse(source) as unknown

  const document = parseDocument(source, {
    merge: false,
    uniqueKeys: true,
  })
  if (document.errors.length > 0) {
    throw new SyntaxError(
      document.errors.map((error) => error.message).join("\n"),
    )
  }
  return document.toJS({ maxAliasCount: 0 }) as unknown
}
