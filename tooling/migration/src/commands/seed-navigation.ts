import { sql } from 'kysely'
import { PostgresAuditWriter } from '@jingwei/audit'
import { PostgresOutboxAppender } from '@jingwei/outbox'
import { loadConfig } from '@jingwei/config'
import { DatabaseRuntime, PostgresTenantDirectory } from '@jingwei/database'
import { newEntityId, newRequestId, newSessionId, toUserId, type AuthContext } from '@jingwei/kernel'
import { ModuleRegistry } from '@jingwei/module-sdk'
import { createNavigationManagement } from '@jingwei/module-navigation/server/public'
import { generatedEdition } from '../../../../apps/server/src/generated/edition.js'

/** Explicit command boundary; importing this module performs no I/O. */
export async function runNavigationSeed(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const config = loadConfig(environment)
  if (config.environment === 'production') throw new Error('Development navigation seed is forbidden in production')
  const runtime = new DatabaseRuntime(config.databaseUrl)
  const registry = new ModuleRegistry(generatedEdition)
  try {
    const db = runtime.view<unknown>()
    const tenant = await new PostgresTenantDirectory(runtime.view()).findActiveByCode(environment.DEV_TENANT_CODE ?? 'default')
    if (tenant === null) throw new Error('Create the development tenant/user with seed:dev first')
    const users = await sql<{ id: string }>`SELECT id FROM iam."user"
      WHERE tenant_id = ${tenant.id} AND username_normalized = ${(environment.DEV_ADMIN_LOGIN ?? 'admin').toLowerCase()} AND status = 'ACTIVE'`.execute(db)
    const user = users.rows[0]
    if (user === undefined) throw new Error('Development administrator does not exist')
    const context: AuthContext = {
      tenantId: tenant.id, userId: toUserId(user.id),
      requestId: newRequestId(), sessionId: newSessionId(), roleIds: []
    }
    const roleId = await db.transaction().execute(async (tx) => {
      const result = await sql<{ id: string }>`INSERT INTO iam.role
        (id, tenant_id, code, name, description, status, is_system, is_super, created_at, created_by, updated_at, updated_by)
        VALUES (${newEntityId()}, ${tenant.id}, 'development-admin', '开发管理员', 'Explicit development grants', 'ACTIVE', true, false, now(), ${user.id}, now(), ${user.id})
        ON CONFLICT (tenant_id, code) DO UPDATE SET updated_at = iam.role.updated_at RETURNING id`.execute(tx)
      const role = result.rows[0]
      if (role === undefined) throw new Error('Role initialization failed')
      await sql`INSERT INTO iam.user_role (tenant_id, user_id, role_id, created_at, created_by)
        VALUES (${tenant.id}, ${user.id}, ${role.id}, now(), ${user.id}) ON CONFLICT DO NOTHING`.execute(tx)
      for (const module of generatedEdition.modules) {
        for (const permission of module.manifest.permissions) {
          await sql`INSERT INTO iam.permission_definition (code, module_id, name, description, supports_data_scope, active, created_at, updated_at)
            VALUES (${permission.code}, ${module.manifest.id}, ${permission.name}, NULL, ${permission.supportsDataScope ?? false}, true, now(), now())
            ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, supports_data_scope = EXCLUDED.supports_data_scope, active = true, updated_at = now()`.execute(tx)
          await sql`INSERT INTO iam.role_permission (tenant_id, role_id, permission_code, scope_type, created_at, created_by)
            VALUES (${tenant.id}, ${role.id}, ${permission.code}, 'ALL', now(), ${user.id}) ON CONFLICT DO NOTHING`.execute(tx)
        }
      }
      await new PostgresAuditWriter(tx).append({
        context, module: 'iam', action: 'development_role_initialized',
        entityType: 'role', entityId: role.id, result: 'SUCCESS', after: { code: 'development-admin' }
      })
      await new PostgresOutboxAppender().append(tx, {
        tenantId: tenant.id, type: 'iam.development_role_initialized',
        version: 1, aggregateType: 'role', aggregateId: role.id, occurredAt: new Date(), payload: { userId: user.id }
      })
      return role.id
    })
    const management = createNavigationManagement(runtime, registry)
    const index = await management.list(context)
    let publishedId = index.publishedVersionId
    if (publishedId === null) {
      const draft = await management.createDraft(context, null)
      const published = await management.publish(context, draft.id, {
        expectedEditRevision: draft.editRevision, expectedPublishedVersionId: null,
      })
      publishedId = published.id
      console.log('Created and published initial database navigation revision ' + String(published.revision))
    } else console.log('Preserved existing published navigation')
    const published = await management.version(context, publishedId)
    const current = await management.roleCodes(context, roleId)
    const assignable = published.nodes.filter((node) => node.accessMode === 'PERMISSION').map((node) => node.code)
    const codes = [...new Set([...current.codes, ...assignable])].filter((code) => assignable.includes(code))
    await management.grantRole(context, roleId, { codes, expectedCodes: current.codes })
    console.log('Granted development administrator navigation codes: ' + codes.join(', '))
    console.log('Existing passwords and published configuration were not overwritten')
  } finally { await runtime.dispose() }
}
