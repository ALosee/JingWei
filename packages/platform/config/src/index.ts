import { z } from 'zod'

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HTTP_HOST: z.string().min(1).default('127.0.0.1'),
  HTTP_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z
    .url()
    .startsWith('postgres')
    .default('postgres://jingwei:jingwei@127.0.0.1:5432/jingwei'),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  BOOTSTRAP_TENANT_CODE: z.string().trim().min(1).max(80).default('default'),
  AUTH_ACCESS_TOKEN_SECONDS: z.coerce.number().int().positive().default(600),
  AUTH_REFRESH_IDLE_SECONDS: z.coerce.number().int().positive().default(1_800),
  AUTH_REFRESH_ABSOLUTE_SECONDS: z.coerce.number().int().positive().default(604_800),
  AUTH_REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).max(30).default(5),
  AUTH_LOGIN_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_LOGIN_LOCK_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
})

export interface AppConfig {
  readonly environment: 'development' | 'test' | 'production'
  readonly http: {
    readonly host: string
    readonly port: number
  }
  readonly databaseUrl: string
  readonly appOrigin: string
  readonly bootstrapTenantCode: string
  readonly session: {
    readonly accessSeconds: number
    readonly refreshIdleSeconds: number
    readonly refreshAbsoluteSeconds: number
    readonly refreshReuseGraceSeconds: number
  }
  readonly login: {
    readonly maxFailedAttempts: number
    readonly lockSeconds: number
  }
}

/**
 * Parses untrusted environment variables into the immutable application configuration.
 * Call once at the process composition root so invalid values fail before the server listens.
 *
 * @throws {z.ZodError} For missing, malformed, or out-of-range values.
 * @throws {Error} When idle session expiry is not below absolute expiry.
 */
export function loadConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const value = configSchema.parse(environment)

  if (value.AUTH_ACCESS_TOKEN_SECONDS >= value.AUTH_REFRESH_ABSOLUTE_SECONDS) {
    throw new Error('AUTH_ACCESS_TOKEN_SECONDS must be lower than AUTH_REFRESH_ABSOLUTE_SECONDS')
  }
  if (value.AUTH_REFRESH_IDLE_SECONDS >= value.AUTH_REFRESH_ABSOLUTE_SECONDS) {
    throw new Error('AUTH_REFRESH_IDLE_SECONDS must be lower than AUTH_REFRESH_ABSOLUTE_SECONDS')
  }
  if (value.AUTH_ACCESS_TOKEN_SECONDS >= value.AUTH_REFRESH_IDLE_SECONDS) {
    throw new Error('AUTH_ACCESS_TOKEN_SECONDS must be lower than AUTH_REFRESH_IDLE_SECONDS')
  }

  return Object.freeze({
    environment: value.NODE_ENV,
    http: Object.freeze({ host: value.HTTP_HOST, port: value.HTTP_PORT }),
    databaseUrl: value.DATABASE_URL,
    appOrigin: value.APP_ORIGIN,
    bootstrapTenantCode: value.BOOTSTRAP_TENANT_CODE,
    session: Object.freeze({
      accessSeconds: value.AUTH_ACCESS_TOKEN_SECONDS,
      refreshIdleSeconds: value.AUTH_REFRESH_IDLE_SECONDS,
      refreshAbsoluteSeconds: value.AUTH_REFRESH_ABSOLUTE_SECONDS,
      refreshReuseGraceSeconds: value.AUTH_REFRESH_REUSE_GRACE_SECONDS,
    }),
    login: Object.freeze({
      maxFailedAttempts: value.AUTH_LOGIN_MAX_FAILED_ATTEMPTS,
      lockSeconds: value.AUTH_LOGIN_LOCK_SECONDS,
    }),
  })
}
