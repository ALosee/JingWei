import { z } from 'zod'

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HTTP_HOST: z.string().min(1).default('127.0.0.1'),
  HTTP_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.url().startsWith('postgres').default(
    'postgres://jingwei:jingwei@127.0.0.1:5432/jingwei',
  ),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  BOOTSTRAP_TENANT_CODE: z.string().trim().min(1).max(80).default('default'),
  SESSION_IDLE_SECONDS: z.coerce.number().int().positive().default(1_800),
  SESSION_ABSOLUTE_SECONDS: z.coerce.number().int().positive().default(604_800),
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
    readonly idleSeconds: number
    readonly absoluteSeconds: number
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

  if (value.SESSION_IDLE_SECONDS >= value.SESSION_ABSOLUTE_SECONDS) {
    throw new Error('SESSION_IDLE_SECONDS must be lower than SESSION_ABSOLUTE_SECONDS')
  }

  return Object.freeze({
    environment: value.NODE_ENV,
    http: Object.freeze({ host: value.HTTP_HOST, port: value.HTTP_PORT }),
    databaseUrl: value.DATABASE_URL,
    appOrigin: value.APP_ORIGIN,
    bootstrapTenantCode: value.BOOTSTRAP_TENANT_CODE,
    session: Object.freeze({
      idleSeconds: value.SESSION_IDLE_SECONDS,
      absoluteSeconds: value.SESSION_ABSOLUTE_SECONDS,
    }),
  })
}
