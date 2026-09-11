import { z } from 'zod'

export const loginInputSchema = z
  .object({
    tenantCode: z.string().trim().min(1).max(80),
    login: z.string().trim().min(1).max(320),
    password: z.string().min(1).max(1_024),
  })
  .meta({ id: 'IamLoginInput', description: 'Credentials used to create an opaque token family' })

export const authenticatedUserSchema = z
  .object({
    id: z.uuid(),
    tenantId: z.uuid(),
    displayName: z.string(),
    avatarUrl: z.string().max(512).nullable(),
  })
  .meta({ id: 'IamAuthenticatedUser' })

export const loginResultSchema = z
  .object({
    user: authenticatedUserSchema,
    session: z.object({
      accessExpiresAt: z.iso.datetime(),
      absoluteExpiresAt: z.iso.datetime(),
    }),
  })
  .meta({ id: 'IamLoginResult' })

export const sessionStatusSchema = z
  .discriminatedUnion('authenticated', [
    z.object({ authenticated: z.literal(false) }),
    z.object({
      authenticated: z.literal(true),
      user: authenticatedUserSchema,
    }),
  ])
  .meta({ id: 'IamSessionStatus' })

export const refreshSessionResultSchema = z
  .object({
    accessExpiresAt: z.iso.datetime(),
    absoluteExpiresAt: z.iso.datetime(),
  })
  .meta({ id: 'IamRefreshSessionResult' })

export const accountProfileSchema = z
  .object({
    id: z.uuid(),
    username: z.string(),
    displayName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    avatarUrl: z.string().max(512).nullable(),
    status: z.enum(['INVITED', 'ACTIVE', 'DISABLED', 'LOCKED']),
    lastLoginAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    passwordChangedAt: z.iso.datetime(),
  })
  .meta({ id: 'IamAccountProfile' })

export const updateAccountInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160).optional(),
    avatarUrl: z.string().max(512).nullable().optional(),
  })
  .meta({ id: 'IamUpdateAccountInput' })

export const changePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(1).max(1_024),
    newPassword: z.string().min(8).max(1_024),
  })
  .meta({ id: 'IamChangePasswordInput' })

export const accountRoleSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    status: z.enum(['INVITED', 'ACTIVE', 'DISABLED', 'LOCKED']),
  })
  .meta({ id: 'IamAccountRole' })

export const accountRolesSchema = z
  .object({
    roles: z.array(accountRoleSchema),
  })
  .meta({ id: 'IamAccountRoles' })

export type LoginInput = z.infer<typeof loginInputSchema>
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>
export type LoginResult = z.infer<typeof loginResultSchema>
export type RefreshSessionResult = z.infer<typeof refreshSessionResultSchema>
export type SessionStatus = z.infer<typeof sessionStatusSchema>
export type AccountProfile = z.infer<typeof accountProfileSchema>
export type UpdateAccountInput = z.infer<typeof updateAccountInputSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>
export type AccountRole = z.infer<typeof accountRoleSchema>
export type AccountRoles = z.infer<typeof accountRolesSchema>
