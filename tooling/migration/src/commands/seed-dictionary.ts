import { sql } from 'kysely'

import { loadConfig } from '@jingwei/config'
import { DatabaseRuntime } from '@jingwei/database'
import { newRequestId, newSessionId, toUserId, type AuthContext } from '@jingwei/kernel'
import { createDictionaryManagement } from '@jingwei/module-dictionary/server/public'
import { ModuleRegistry } from '@jingwei/module-sdk'
import { generatedEdition } from '@jingwei/server/edition'
import { PostgresTenantDirectory } from '@jingwei/tenancy'

interface SeedItem {
  code: string
  label: string
  sortOrder: number
}

interface SeedType {
  code: string
  name: string
  items: SeedItem[]
}

const CATEGORY_CODE = 'common'
const CATEGORY_NAME = '系统通用'

const SEED_TYPES: SeedType[] = [
  {
    code: 'common.source',
    name: '来源类型',
    items: [
      { code: 'website', label: '官网', sortOrder: 10 },
      { code: 'referral', label: '转介绍', sortOrder: 20 },
      { code: 'ads', label: '广告投放', sortOrder: 30 },
      { code: 'other', label: '其他', sortOrder: 90 },
    ],
  },
  {
    code: 'common.priority',
    name: '优先级',
    items: [
      { code: 'low', label: '低', sortOrder: 10 },
      { code: 'medium', label: '中', sortOrder: 20 },
      { code: 'high', label: '高', sortOrder: 30 },
    ],
  },
  {
    code: 'common.tag',
    name: '业务标签',
    items: [
      { code: 'vip', label: 'VIP', sortOrder: 10 },
      { code: 'trial', label: '试用', sortOrder: 20 },
      { code: 'partner', label: '合作伙伴', sortOrder: 30 },
    ],
  },
]

/** Idempotent development seed for tenant dictionary samples. Forbidden in production. */
export async function runDictionarySeed(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const config = loadConfig(environment)
  if (config.environment === 'production')
    throw new Error('Development dictionary seed is forbidden in production')

  const runtime = new DatabaseRuntime(config.databaseUrl)
  const registry = new ModuleRegistry(generatedEdition)
  try {
    const tenant = await new PostgresTenantDirectory(runtime.view()).findActiveByCode(
      environment.DEV_TENANT_CODE ?? 'default',
    )
    if (tenant === null) throw new Error('Create the development tenant/user with seed:dev first')

    const users = await sql<{ id: string }>`SELECT id FROM iam."user"
      WHERE tenant_id = ${tenant.id}
        AND username_normalized = ${(environment.DEV_ADMIN_LOGIN ?? 'admin').toLowerCase()}
        AND status = 'ACTIVE'`.execute(runtime.view())
    const user = users.rows[0]
    if (user === undefined) throw new Error('Development administrator does not exist')

    const context: AuthContext = {
      tenantId: tenant.id,
      userId: toUserId(user.id),
      requestId: newRequestId(),
      sessionId: newSessionId(),
      roleIds: [],
    }

    const manage = createDictionaryManagement(runtime, registry)
    const catalog = await manage.catalog(context)
    let category = catalog.categories.find((item) => item.code === CATEGORY_CODE)
    if (category === undefined) {
      category = await manage.createCategory(context, {
        code: CATEGORY_CODE,
        name: CATEGORY_NAME,
        sortOrder: 0,
      })
      console.log('Created dictionary category ' + CATEGORY_CODE)
    }

    for (const seed of SEED_TYPES) {
      const known = catalog.types.some((type) => type.code === seed.code)
      let detail = known ? await manage.detailByCode(context, seed.code) : null
      if (detail === null) {
        detail = await manage.createType(context, {
          categoryId: category.id,
          code: seed.code,
          name: seed.name,
          status: 'ENABLED',
        })
        console.log('Created dictionary type ' + seed.code)
      }

      let revision = detail.type.revision
      const existingCodes = new Set(detail.items.map((item) => item.code))
      for (const item of seed.items) {
        if (existingCodes.has(item.code)) continue
        detail = await manage.createItem(context, detail.type.id, {
          code: item.code,
          label: item.label,
          sortOrder: item.sortOrder,
          status: 'ENABLED',
          expectedRevision: revision,
        })
        revision = detail.type.revision
        console.log(`Created dictionary item ${seed.code}.${item.code}`)
      }
    }

    console.log('Dictionary seed completed')
  } finally {
    await runtime.dispose()
  }
}
