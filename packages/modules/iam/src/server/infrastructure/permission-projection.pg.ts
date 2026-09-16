import type { Kysely } from 'kysely'

import type { ModuleRegistry } from '@jingwei/module-sdk'

import type { RoleDatabase } from './role-store.pg.js'

/**
 * Projects enabled edition permissions into `iam.permission_definition`.
 * Runtime authorization and grant display read ModuleRegistry; this durable projection
 * is for seed/ops tooling only. Do not call it from module install — install must not
 * require a live database.
 */
export async function syncPermissionDefinitions(
  database: Kysely<RoleDatabase>,
  registry: ModuleRegistry,
  now: Date = new Date(),
): Promise<void> {
  const permissions = registry.permissions()
  await database.transaction().execute(async (tx) => {
    for (const permission of permissions) {
      await tx
        .insertInto('iam.permission_definition')
        .values({
          code: permission.code,
          module_id: permission.moduleId,
          name: permission.name,
          description: null,
          allowed_scope_types: [...(permission.dataScope?.allowedTypes ?? ['ALL'])],
          data_scope_provider: permission.dataScope?.provider ?? null,
          active: true,
          created_at: now,
          updated_at: now,
        })
        .onConflict((oc) =>
          oc.column('code').doUpdateSet({
            module_id: permission.moduleId,
            name: permission.name,
            allowed_scope_types: [...(permission.dataScope?.allowedTypes ?? ['ALL'])],
            data_scope_provider: permission.dataScope?.provider ?? null,
            active: true,
            updated_at: now,
          }),
        )
        .execute()
    }
    if (permissions.length === 0) {
      await tx
        .updateTable('iam.permission_definition')
        .set({ active: false, updated_at: now })
        .execute()
      return
    }
    await tx
      .updateTable('iam.permission_definition')
      .set({ active: false, updated_at: now })
      .where(
        'code',
        'not in',
        permissions.map((permission) => permission.code),
      )
      .execute()
  })
}
