import { z } from "zod"

import { entityIdSchema } from "@/domain/common"

export const employmentStatusValues = {
  employed: "employed",
  onLeave: "on-leave",
  resigned: "resigned",
} as const
export const employmentStatusSchema = z.enum(employmentStatusValues)

export const organizationInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  leaderUserId: entityIdSchema,
  parentId: entityIdSchema.optional(),
})

export const userInputSchema = z
  .object({
    nickname: z.string().trim().min(2).max(40),
    email: z.email().max(160),
    employmentStatus: employmentStatusSchema,
    organizationIds: z
      .array(entityIdSchema)
      .max(20)
      .refine((values) => new Set(values).size === values.length),
  })
  .refine(
    (user) =>
      user.employmentStatus === employmentStatusValues.resigned ||
      user.organizationIds.length > 0,
    { path: ["organizationIds"] },
  )

export const roleInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(500),
})

export const applicationInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/),
  description: z.string().trim().min(2).max(500),
  ownerOrganizationId: entityIdSchema,
})

export type EmploymentStatus = z.infer<typeof employmentStatusSchema>
export const employmentStatuses: EmploymentStatus[] = [
  employmentStatusValues.employed,
  employmentStatusValues.onLeave,
  employmentStatusValues.resigned,
]

export type OrganizationInput = z.infer<typeof organizationInputSchema>
export type UserInput = z.infer<typeof userInputSchema>
export type RoleInput = z.infer<typeof roleInputSchema>
export type ApplicationInput = z.infer<typeof applicationInputSchema>

export type Organization = OrganizationInput & {
  id: string
  createdAt: string
}

export type BackofficeUser = UserInput & {
  id: string
  createdAt: string
}

export type Role = RoleInput & {
  id: string
  userIds: string[]
  organizationIds: string[]
  createdAt: string
}

export type Application = ApplicationInput & {
  id: string
  createdAt: string
}
