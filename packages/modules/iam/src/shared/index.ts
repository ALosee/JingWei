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
      user: authenticatedUserSchema.pick({ id: true, tenantId: true }),
    }),
  ])
  .meta({ id: 'IamSessionStatus' })

export const refreshSessionResultSchema = z
  .object({
    accessExpiresAt: z.iso.datetime(),
    absoluteExpiresAt: z.iso.datetime(),
  })
  .meta({ id: 'IamRefreshSessionResult' })

export type LoginInput = z.infer<typeof loginInputSchema>
export type LoginResult = z.infer<typeof loginResultSchema>
export type RefreshSessionResult = z.infer<typeof refreshSessionResultSchema>
export type SessionStatus = z.infer<typeof sessionStatusSchema>
