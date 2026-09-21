import type { PlatformAuditContext } from '@jingwei/audit'
import { PostgresSessionRepository, SessionService, type AuthDatabase } from '@jingwei/auth'
import { loadConfig } from '@jingwei/config'
import { createTenantOperations } from '@jingwei/control-plane/server'
import { DatabaseRuntime } from '@jingwei/database'
import { newRequestId, systemClock } from '@jingwei/kernel'
import { ModuleRegistry } from '@jingwei/module-sdk'
import { generatedEdition } from '@jingwei/server/edition'
import { createTenantManagement, PostgresTenantDirectory } from '@jingwei/tenancy'

type Command = 'create' | 'retry' | 'list' | 'suspend' | 'resume' | 'disable'

interface ParsedArguments {
  readonly command: Command
  readonly values: ReadonlyMap<string, string>
}

export function runTenantManagementCli(): Promise<void> {
  return runTenantManagementCommand(process.argv.slice(2), process.env)
}

export async function runTenantManagementCommand(
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const parsed = parseArguments(arguments_)
  const config = loadConfig(environment)
  const actorId = requiredEnvironment(environment, 'TENANT_OPERATOR_ID')
  const database = new DatabaseRuntime(config.databaseUrl)
  try {
    const directory = new PostgresTenantDirectory(database.view())
    const sessions = new SessionService(
      new PostgresSessionRepository(database.view<AuthDatabase>()),
      systemClock,
      config.session,
      directory,
    )
    const tenants = createTenantManagement(database, sessions)
    const context: PlatformAuditContext = {
      requestId: newRequestId(),
      actor: { type: 'CLI', id: actorId },
    }
    if (parsed.command === 'list') {
      console.log(JSON.stringify(await tenants.list(), null, 2))
      return
    }

    const code = requiredValue(parsed.values, 'code')
    if (parsed.command === 'create' || parsed.command === 'retry') {
      const operations = createTenantOperations({
        database,
        registry: new ModuleRegistry(generatedEdition),
        tenantSessions: sessions,
      })
      const adminEmail = parsed.values.get('admin-email')
      const administrator = {
        initialPassword: requiredSecretEnvironment(environment, 'TENANT_ADMIN_PASSWORD'),
        adminLogin: requiredValue(parsed.values, 'admin-login'),
        adminName: requiredValue(parsed.values, 'admin-name'),
        ...(adminEmail === undefined ? {} : { adminEmail }),
      }
      const result =
        parsed.command === 'create'
          ? await operations.provision.create(context, {
              code,
              name: requiredValue(parsed.values, 'name'),
              defaultLocale: parsed.values.get('locale') ?? 'zh-CN',
              defaultTimezone: parsed.values.get('timezone') ?? 'Asia/Shanghai',
              defaultCurrency: parsed.values.get('currency') ?? 'CNY',
              ...administrator,
            })
          : await operations.provision.retry(
              context,
              (await operations.tenants.getByCode(code)).id,
              administrator,
            )
      console.log(JSON.stringify(result, null, 2))
      return
    }

    const tenant = await tenants.getByCode(code)
    const updated =
      parsed.command === 'suspend'
        ? await tenants.suspend(context, tenant.id)
        : parsed.command === 'resume'
          ? await tenants.resume(context, tenant.id)
          : await tenants.disable(context, tenant.id)
    console.log(JSON.stringify(updated, null, 2))
  } finally {
    await database.dispose()
  }
}

function parseArguments(arguments_: readonly string[]): ParsedArguments {
  const [commandValue, ...options] = arguments_
  if (!isCommand(commandValue)) usage()
  const values = new Map<string, string>()
  for (let index = 0; index < options.length; index += 2) {
    const key = options[index]
    const value = options[index + 1]
    if (key === undefined || value === undefined || !key.startsWith('--')) usage()
    values.set(key.slice(2), value)
  }
  return { command: commandValue, values }
}

function isCommand(value: string | undefined): value is Command {
  return ['create', 'retry', 'list', 'suspend', 'resume', 'disable'].includes(value ?? '')
}

function requiredValue(values: ReadonlyMap<string, string>, name: string): string {
  const value = values.get(name)?.trim()
  if (value === undefined || value.length === 0) usage()
  return value
}

function requiredEnvironment(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim()
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`)
  if (value.length > 160) throw new Error(`${name} must not exceed 160 characters`)
  return value
}

function requiredSecretEnvironment(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`)
  return value
}

function usage(): never {
  throw new Error(
    'Usage: tenant:manage <create|retry|list|suspend|resume|disable> [--code value] [--name value] [--admin-login value] [--admin-name value] [--admin-email value] [--locale value] [--timezone value] [--currency value]',
  )
}
