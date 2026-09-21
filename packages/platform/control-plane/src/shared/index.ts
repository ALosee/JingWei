import { z } from 'zod'

export * from './cookies.js'
export * from './paths.js'

export const platformOperatorSchema = z
  .object({
    id: z.uuid(),
    login: z.string().min(1).max(120),
    displayName: z.string().min(1).max(160),
  })
  .strict()

export const platformLoginInputSchema = z
  .object({
    login: z.string().trim().min(1).max(120),
    password: z.string().min(1).max(1_024),
  })
  .strict()

export const platformLoginResultSchema = z
  .object({
    operator: platformOperatorSchema,
    session: z.object({
      accessExpiresAt: z.iso.datetime(),
      absoluteExpiresAt: z.iso.datetime(),
    }),
  })
  .strict()

export const platformSessionStatusSchema = z.discriminatedUnion('authenticated', [
  z.object({ authenticated: z.literal(false) }).strict(),
  z
    .object({
      authenticated: z.literal(true),
      operator: platformOperatorSchema,
    })
    .strict(),
])

export const platformRefreshSessionResultSchema = z
  .object({
    accessExpiresAt: z.iso.datetime(),
    absoluteExpiresAt: z.iso.datetime(),
  })
  .strict()

export const platformTenantStatusSchema = z.enum([
  'PROVISIONING',
  'ACTIVE',
  'SUSPENDED',
  'DISABLED',
])
export const platformTenantProvisioningStepSchema = z.enum([
  'TENANT_RESERVED',
  'IAM_INITIALIZED',
  'NAVIGATION_INITIALIZED',
  'COMPLETED',
])
export const platformTenantSchema = z
  .object({
    id: z.uuid(),
    code: z.string(),
    name: z.string(),
    status: platformTenantStatusSchema,
    defaultLocale: z.string(),
    defaultTimezone: z.string(),
    defaultCurrency: z.string(),
    version: z.number().int().positive(),
    provisioningStep: platformTenantProvisioningStepSchema,
    provisioningErrorCode: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()

export const platformTenantListSchema = z
  .object({ tenants: z.array(platformTenantSchema).max(10_000) })
  .strict()

export const createPlatformTenantSchema = z
  .object({
    code: z.string().trim().min(1).max(63),
    name: z.string().trim().min(1).max(200),
    defaultLocale: z.string().trim().min(2).max(20).default('zh-CN'),
    defaultTimezone: z.string().trim().min(1).max(80).default('Asia/Shanghai'),
    defaultCurrency: z.string().trim().length(3).default('CNY'),
    adminLogin: z.string().trim().min(1).max(120),
    adminName: z.string().trim().min(1).max(160),
    adminEmail: z.email().max(320).optional(),
    initialPassword: z.string().min(12).max(1_024),
  })
  .strict()

export const retryPlatformTenantSchema = z
  .object({
    adminLogin: z.string().trim().min(1).max(120),
    adminName: z.string().trim().min(1).max(160),
    adminEmail: z.email().max(320).optional(),
    initialPassword: z.string().min(12).max(1_024),
  })
  .strict()

export type PlatformOperator = z.infer<typeof platformOperatorSchema>
export type PlatformLoginInput = z.infer<typeof platformLoginInputSchema>
export type PlatformLoginResult = z.infer<typeof platformLoginResultSchema>
export type PlatformSessionStatus = z.infer<typeof platformSessionStatusSchema>
export type PlatformTenant = z.infer<typeof platformTenantSchema>
export type CreatePlatformTenant = z.infer<typeof createPlatformTenantSchema>
export type RetryPlatformTenant = z.infer<typeof retryPlatformTenantSchema>
