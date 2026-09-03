import { z } from 'zod'

export const loginInputSchema = z.object({
  tenantCode: z.string().trim().min(1).max(80),
  login: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(1_024),
})

export const authenticatedUserSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  displayName: z.string(),
})

export const loginResultSchema = z.object({
  user: authenticatedUserSchema,
  csrfToken: z.string(),
})

export const sessionStatusSchema = z.discriminatedUnion('authenticated', [
  z.object({ authenticated: z.literal(false) }),
  z.object({
    authenticated: z.literal(true),
    user: authenticatedUserSchema.pick({ id: true, tenantId: true }),
  }),
])

export type LoginInput = z.infer<typeof loginInputSchema>
export type LoginResult = z.infer<typeof loginResultSchema>
export type SessionStatus = z.infer<typeof sessionStatusSchema>
