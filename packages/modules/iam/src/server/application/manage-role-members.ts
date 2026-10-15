import { ApplicationError, type AuthContext } from '@jingwei/kernel'

import type { ChangeRoleMembers, ClearRoleMembers, RoleMemberQuery } from '../../shared/index.js'
import type { IamAccess } from '../public/navigation-access.js'
import { iamPermissionRequirements } from '../public/permission-requirements.js'
import type { RoleMemberTransaction, RoleMemberUnitOfWork } from './role-member-store.js'

function fail(code: string, message: string, status = 409): never {
  throw new ApplicationError({ code, message, status })
}

/** Role-owned view of the same user_role relationship used by user administration. */
export class ManageRoleMembers {
  constructor(
    private readonly work: RoleMemberUnitOfWork,
    private readonly access: IamAccess,
  ) {}

  private async authorize(context: AuthContext, manage: boolean) {
    if (manage) {
      await this.access.requireUnscopedPermission(context, iamPermissionRequirements.roleManage)
      await this.access.requireUnscopedPermission(context, iamPermissionRequirements.userManage)
    } else await this.access.requireUnscopedPermission(context, iamPermissionRequirements.roleView)
  }

  private async requiredRole(tx: RoleMemberTransaction, context: AuthContext, roleId: string) {
    // The same lock serializes both user-oriented replacement and role-oriented mutations.
    await tx.store.lockAdministration(context.tenantId)
    const role = await tx.store.lockRole(context.tenantId, roleId)
    if (role === null) fail('IAM_ROLE_NOT_FOUND', '角色不存在', 404)
    return role
  }

  async list(context: AuthContext, roleId: string, query: RoleMemberQuery, candidates = false) {
    await this.authorize(context, candidates)
    return this.work.run(async (tx) => {
      await this.requiredRole(tx, context, roleId)
      const state = await tx.store.snapshot(context.tenantId, roleId)
      const result = await tx.store.list(context.tenantId, roleId, query, candidates)
      return {
        ...result,
        page: query.page,
        pageSize: query.pageSize,
        assignmentCount: state.userIds.length,
        snapshot: state.snapshot,
      }
    })
  }

  private async change(
    context: AuthContext,
    roleId: string,
    input: ClearRoleMembers & { userIds?: readonly string[] },
    action: 'add' | 'remove' | 'clear',
  ) {
    await this.authorize(context, true)
    return this.work.run(async (tx) => {
      const role = await this.requiredRole(tx, context, roleId)
      const before = await tx.store.snapshot(context.tenantId, roleId)
      if (before.snapshot !== input.expectedSnapshot)
        fail('IAM_ROLE_MEMBERS_CONFLICT', '角色成员已变化，请刷新列表后重新确认')
      const requested = [...new Set(input.userIds ?? [])]
      if (
        action !== 'clear' &&
        (requested.length === 0 || requested.length !== input.userIds?.length)
      )
        fail('IAM_ROLE_MEMBERS_INVALID', '请选择不重复的用户', 400)
      const existing = new Set(before.userIds)
      let affected: readonly string[]
      if (action === 'add') {
        if (role.status !== 'ACTIVE')
          fail('IAM_ROLE_DISABLED', '停用角色不能添加用户，请先启用角色')
        const valid = await tx.store.lockActiveUsers(context.tenantId, requested)
        if (valid.length !== requested.length)
          fail('IAM_USER_NOT_AVAILABLE', '指定用户不存在、不属于当前租户或不是正常状态', 400)
        affected = requested.filter((id) => !existing.has(id))
        if (affected.length > 0) await tx.store.add(context, roleId, affected)
      } else {
        affected = action === 'clear' ? before.userIds : requested.filter((id) => existing.has(id))
        if (affected.length > 0) {
          if (action === 'clear') await tx.store.clear(context, roleId)
          else await tx.store.remove(context, roleId, affected)
          // Evaluate the whole resulting graph, including the caller and unions of other roles.
          if (!(await tx.store.hasActiveManager(context.tenantId)))
            fail(
              'IAM_USER_LAST_MANAGER',
              '不能解除最后一个有效用户管理员的管理角色，请先授权其他管理员',
            )
        }
      }
      const after = await tx.store.snapshot(context.tenantId, roleId)
      if (affected.length > 0)
        await tx.record(
          context,
          `role_members_${action === 'add' ? 'added' : action === 'clear' ? 'cleared' : 'removed'}`,
          roleId,
          { snapshot: before.snapshot, assignmentCount: before.userIds.length },
          {
            snapshot: after.snapshot,
            assignmentCount: after.userIds.length,
            affectedUserIds: affected,
          },
        )
      return {
        affectedCount: affected.length,
        assignmentCount: after.userIds.length,
        snapshot: after.snapshot,
        affectsCurrentUser: affected.includes(context.userId),
      }
    })
  }

  add(context: AuthContext, roleId: string, input: ChangeRoleMembers) {
    return this.change(context, roleId, input, 'add')
  }
  remove(context: AuthContext, roleId: string, input: ChangeRoleMembers) {
    return this.change(context, roleId, input, 'remove')
  }
  clear(context: AuthContext, roleId: string, input: ClearRoleMembers) {
    return this.change(context, roleId, input, 'clear')
  }
}
