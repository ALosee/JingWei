import { z } from 'zod'

/** Stable JSON error envelope returned by every Jingwei HTTP API boundary. */
export const apiErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string(),
    requestId: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .meta({ id: 'ApiError', description: 'Stable Jingwei HTTP error envelope' })

export type ApiError = z.infer<typeof apiErrorSchema>

export const openApiSecurityNames = {
  sessionCookie: 'sessionCookie',
  csrfHeader: 'csrfHeader',
} as const
