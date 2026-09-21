import { loadConfig } from '@jingwei/config'
import { createPlatformOperatorBootstrap } from '@jingwei/control-plane/server'
import { DatabaseRuntime } from '@jingwei/database'
import { newRequestId } from '@jingwei/kernel'

export function runPlatformBootstrapCli(): Promise<void> {
  return runPlatformBootstrapCommand(process.argv.slice(2), process.env)
}

export async function runPlatformBootstrapCommand(
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const values = parseOptions(arguments_)
  const login = requiredValue(values, 'login')
  const name = requiredValue(values, 'name')
  const password = requiredSecret(environment, 'PLATFORM_OPERATOR_PASSWORD')
  const config = loadConfig(environment)
  const database = new DatabaseRuntime(config.databaseUrl)
  try {
    const operator = await createPlatformOperatorBootstrap(database).execute(
      {
        requestId: newRequestId(),
        actor: { type: 'CLI', id: `bootstrap:${login}` },
      },
      { login, displayName: name, password },
    )
    console.log(
      JSON.stringify(
        {
          operator,
          loginUrl: '/platform/login',
          message: '首位平台管理员已创建，请立即登录平台管理后台。',
        },
        null,
        2,
      ),
    )
  } finally {
    await database.dispose()
  }
}

function parseOptions(arguments_: readonly string[]): ReadonlyMap<string, string> {
  if (arguments_.length === 0 || arguments_.length % 2 !== 0) usage()
  const values = new Map<string, string>()
  for (let index = 0; index < arguments_.length; index += 2) {
    const key = arguments_[index]
    const value = arguments_[index + 1]
    if (key === undefined || value === undefined || !key.startsWith('--')) usage()
    values.set(key.slice(2), value)
  }
  return values
}

function requiredValue(values: ReadonlyMap<string, string>, name: string): string {
  const value = values.get(name)?.trim()
  if (value === undefined || value.length === 0) usage()
  return value
}

function requiredSecret(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required`)
  }
  return value
}

function usage(): never {
  throw new Error('Usage: platform:bootstrap --login value --name value')
}
