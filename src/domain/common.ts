import { z } from "zod"

export const entityStatusSchema = z.enum(["active", "inactive"])
export const entityIdSchema = z.uuid()
export const entityIdListSchema = z
  .array(entityIdSchema)
  .min(1)
  .max(100)
  .refine((values) => new Set(values).size === values.length)

export type EntityStatus = z.infer<typeof entityStatusSchema>

export type BackofficeErrorCode =
  | "invalid-input"
  | "organization-not-found"
  | "user-email-exists"
  | "user-nickname-exists"
  | "user-not-found"
  | "role-name-exists"
  | "role-not-found"
  | "group-name-exists"
  | "group-not-found"
  | "role-in-use"
  | "group-in-use"
  | "policy-name-exists"
  | "policy-operation-forbidden"
  | "policy-not-found"
  | "policy-assignment-not-found"
  | "policy-assignment-forbidden"
  | "access-policy-already-assigned"
  | "protected-relationship"
  | "approval-line-not-found"
  | "approval-line-ambiguous"
  | "approval-reference-mismatch"
  | "approval-document-not-found"
  | "notification-not-found"
  | "notification-operation-forbidden"
  | "approval-document-not-submitted"
  | "approval-document-not-approved"
  | "api-key-request-invalid"
  | "credential-already-owned"
  | "api-key-already-registered"
  | "api-key-registration-forbidden"
  | "internal-credential-registration-failed"
  | "service-code-exists"
  | "service-not-found"
  | "endpoint-service-invalid"
  | "endpoint-exists"
  | "endpoint-not-found"
  | "ui-resource-import-forbidden"
  | "ui-resource-delete-forbidden"
  | "ui-resource-status-forbidden"
  | "ui-namespace-operation-forbidden"
  | "ui-namespace-key-exists"
  | "ui-namespace-name-exists"
  | "ui-namespace-not-found"
  | "ui-resource-not-found"
  | "ui-resource-namespace-mismatch"
  | "ui-resource-parent-not-found"

export type CommandResult<Entity> =
  { ok: true; value: Entity } | { ok: false; error: BackofficeErrorCode }
