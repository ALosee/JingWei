import { Argon2idPasswordHasher } from '@jingwei/auth'
import { loadConfig } from '@jingwei/config'
import { DatabaseRuntime } from '@jingwei/database'
import { newTenantId, newUserId } from '@jingwei/kernel'

interface TenantTable {
  id: string
  code: string
  name: string
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED'
  default_locale: string
  default_timezone: string
  default_currency: string
  settings: unknown
  created_at: Date
  updated_at: Date
}

interface UserTable {
  id: string
  tenant_id: string
  username: string
  username_normalized: string
  email: string | null
  email_normalized: string | null
  phone: string | null
  display_name: string
  avatar: string | null
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED'
  last_login_at: Date | null
  created_at: Date
  created_by: string | null
  updated_at: Date
  updated_by: string | null
}

interface CredentialTable {
  user_id: string
  password_hash: string
  password_changed_at: Date
  failed_attempts: number
  locked_until: Date | null
  created_at: Date
  updated_at: Date
}

interface SeedDatabase {
  'platform.tenant': TenantTable
  'iam.user': UserTable
  'iam.user_credential': CredentialTable
}

/** Explicit command boundary; importing this module performs no I/O. */
export async function runDevelopmentSeed(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const config = loadConfig(environment)
  if (config.environment === 'production') {
    throw new Error('Development seed is forbidden in production')
  }

  const password = environment.DEV_ADMIN_PASSWORD
  if (password === undefined || password.length < 12) {
    throw new Error('DEV_ADMIN_PASSWORD must contain at least 12 characters')
  }

  const tenantCode = environmentText('DEV_TENANT_CODE', 'default')
  const tenantName = environmentText('DEV_TENANT_NAME', 'Jingwei Development')
  const adminLogin = environmentText('DEV_ADMIN_LOGIN', 'admin')
  const adminDisplayName = environmentText('DEV_ADMIN_DISPLAY_NAME', 'Local Administrator')
  const normalizedLogin = adminLogin.toLocaleLowerCase('en-US')
  const now = new Date()
  const passwordHash = await new Argon2idPasswordHasher().hash(password)
  const runtime = new DatabaseRuntime(config.databaseUrl)

  try {
    const database = runtime.view<SeedDatabase>()
    const result = await database.transaction().execute(async (transaction) => {
      let tenant = await transaction
        .selectFrom('platform.tenant')
        .select(['id', 'code'])
        .where('code', '=', tenantCode)
        .executeTakeFirst()

      if (tenant === undefined) {
        tenant = { id: newTenantId(), code: tenantCode }
        await transaction
          .insertInto('platform.tenant')
          .values({
            id: tenant.id,
            code: tenant.code,
            name: tenantName,
            status: 'ACTIVE',
            default_locale: 'zh-CN',
            default_timezone: 'Asia/Shanghai',
            default_currency: 'CNY',
            settings: {},
            created_at: now,
            updated_at: now,
          })
          .executeTakeFirstOrThrow()
      } else {
        await transaction
          .updateTable('platform.tenant')
          .set({ name: tenantName, status: 'ACTIVE', updated_at: now })
          .where('id', '=', tenant.id)
          .executeTakeFirst()
      }

      let user = await transaction
        .selectFrom('iam.user')
        .select(['id'])
        .where('tenant_id', '=', tenant.id)
        .where('username_normalized', '=', normalizedLogin)
        .executeTakeFirst()

      if (user === undefined) {
        user = { id: newUserId() }
        await transaction
          .insertInto('iam.user')
          .values({
            id: user.id,
            tenant_id: tenant.id,
            username: adminLogin,
            username_normalized: normalizedLogin,
            email: null,
            email_normalized: null,
            phone: null,
            display_name: adminDisplayName,
            avatar: null,
            status: 'ACTIVE',
            last_login_at: null,
            created_at: now,
            created_by: null,
            updated_at: now,
            updated_by: null,
          })
          .executeTakeFirstOrThrow()
      } else {
        await transaction
          .updateTable('iam.user')
          .set({ display_name: adminDisplayName, status: 'ACTIVE', updated_at: now })
          .where('id', '=', user.id)
          .where('tenant_id', '=', tenant.id)
          .executeTakeFirst()
      }

      const credential = await transaction
        .selectFrom('iam.user_credential')
        .select('user_id')
        .where('user_id', '=', user.id)
        .executeTakeFirst()

      if (credential === undefined) {
        await transaction
          .insertInto('iam.user_credential')
          .values({
            user_id: user.id,
            password_hash: passwordHash,
            password_changed_at: now,
            failed_attempts: 0,
            locked_until: null,
            created_at: now,
            updated_at: now,
          })
          .executeTakeFirstOrThrow()
      } else {
        await transaction
          .updateTable('iam.user_credential')
          .set({
            password_hash: passwordHash,
            password_changed_at: now,
            failed_attempts: 0,
            locked_until: null,
            updated_at: now,
          })
          .where('user_id', '=', user.id)
          .executeTakeFirst()
      }

      return { tenantId: tenant.id, userId: user.id }
    })

    console.log(`Seeded development tenant ${tenantCode} and user ${adminLogin}`)
    console.log(`Tenant ID: ${result.tenantId}`)
    console.log(`User ID: ${result.userId}`)
  } finally {
    await runtime.dispose()
  }

  function environmentText(name: string, fallback: string): string {
    const value = environment[name]?.trim()
    return value === undefined || value.length === 0 ? fallback : value
  }
}
