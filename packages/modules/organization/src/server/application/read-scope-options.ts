import type { AuthContext } from '@jingwei/kernel'
import { iamPermissionRequirements, type IamAccess } from '@jingwei/module-iam/server/public'

import type { OrgUnitStore } from './org-unit-store.js'

/** Central role administrators need the complete enabled tenant directory when defining grants. */
export class ReadOrganizationalScopeOptions {
  constructor(
    private readonly store: Pick<OrgUnitStore, 'list'>,
    private readonly access: IamAccess,
  ) {}

  async list(context: AuthContext) {
    await this.access.requireUnscopedPermission(context, iamPermissionRequirements.roleManage)
    const units = await this.store.list(context.tenantId)
    return {
      units: units
        .filter((unit) => unit.status === 'ENABLED')
        .map(({ id, parentId, code, name }) => ({
          id,
          parentId,
          code,
          name,
          status: 'ENABLED' as const,
        })),
    }
  }
}
