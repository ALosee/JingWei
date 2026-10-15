import type { QueryCreator } from 'kysely'

import type { TenantId } from '@jingwei/kernel'

import type { IamDatabase } from './credential-reader.pg.js'

/** Effective user managers are the union of grants on every active role of an active user. */
export function activeManagerQuery(database: QueryCreator<IamDatabase>, tenantId: TenantId) {
  return database
    .selectFrom('iam.user as user')
    .innerJoin('iam.user_role as userRole', 'userRole.user_id', 'user.id')
    .innerJoin('iam.role as role', 'role.id', 'userRole.role_id')
    .innerJoin('iam.role_permission as grant', 'grant.role_id', 'role.id')
    .where('user.tenant_id', '=', tenantId)
    .where('userRole.tenant_id', '=', tenantId)
    .where('user.status', '=', 'ACTIVE')
    .where('role.tenant_id', '=', tenantId)
    .where('role.status', '=', 'ACTIVE')
    .where('grant.tenant_id', '=', tenantId)
    .where('grant.permission_code', '=', 'iam.user.manage')
}
