import { z } from 'zod'

export const loginInputSchema = z
  .object({
    tenantCode: z.string().trim().min(1).max(80),
    login: z.string().trim().min(1).max(320),
    password: z.string().min(1).max(1_024),
  })
  .meta({ id: 'IamLoginInput', description: 'Credentials used to create a server-side session' })

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
    csrfToken: z.string(),
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

export type LoginInput = z.infer<typeof loginInputSchema>
export type LoginResult = z.infer<typeof loginResultSchema>
export type SessionStatus = z.infer<typeof sessionStatusSchema>
