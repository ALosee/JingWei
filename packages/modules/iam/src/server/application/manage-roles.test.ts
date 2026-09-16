import { describe, expect, it } from 'vitest'

import {
  newRequestId,
  newSessionId,
  newTenantId,
  newUserId,
  type ApplicationContext,
  type AuthContext,
} from '@jingwei/kernel'
import { ModuleRegistry, type ResolvedEdition } from '@jingwei/module-sdk'

import type { IamRole, RolePermissionGrant, UpdateIamRole } from '../../shared/index.js'
import type { OrganizationalScopeFacts } from '../public/authorization.js'
import type { IamAccess } from '../public/navigation-access.js'
import { ManageIamRoles } from './manage-roles.js'
import { ReadPermissionCatalog } from './permission-catalog.js'
import type { RoleStore, RoleTransaction, RoleUnitOfWork } from './role-store.js'

const context: AuthContext = {
  requestId: newRequestId(),
  tenantId: newTenantId(),
  userId: newUserId(),
  sessionId: newSessionId(),
  roleIds: [],
}

class MemoryRoleStore implements RoleStore {
  roles = new Map<string, IamRole>()
  grants = new Map<string, RolePermissionGrant[]>()
  assigned = new Set<string>()

  list() {
    return Promise.resolve(
      [...this.roles.values()].toSorted((a, b) => a.code.localeCompare(b.code)),
    )
  }
  get(_tenantId: string, id: string) {
    return Promise.resolve(this.roles.get(id) ?? null)
  }
  codeTaken(_tenantId: string, code: string, exceptId?: string) {
    for (const role of this.roles.values()) {
      if (role.code === code && role.id !== exceptId) return Promise.resolve(true)
    }
    return Promise.resolve(false)
  }
  hasAssignments(_tenantId: string, id: string) {
    return Promise.resolve(this.assigned.has(id))
  }
  insert(_context: ApplicationContext, role: IamRole) {
    this.roles.set(role.id, role)
    this.grants.set(role.id, [])
    return Promise.resolve()
  }
  update(_context: ApplicationContext, id: string, patch: UpdateIamRole) {
    const existing = this.roles.get(id)
    if (existing === undefined) return Promise.resolve()
    this.roles.set(id, {
      ...existing,
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.description === undefined ? {} : { description: patch.description }),
      ...(patch.status === undefined ? {} : { status: patch.status }),
      updatedAt: new Date().toISOString(),
    })
    return Promise.resolve()
  }
  delete(_context: ApplicationContext, id: string) {
    this.roles.delete(id)
    this.grants.delete(id)
    return Promise.resolve()
  }
  listGrants(_tenantId: string, roleId: string) {
    return Promise.resolve(this.grants.get(roleId) ?? [])
  }
  replaceGrants(
    _context: ApplicationContext,
    roleId: string,
    grants: readonly RolePermissionGrant[],
  ) {
    this.grants.set(roleId, [...grants])
    return Promise.resolve()
  }
}

function createRegistry(): ModuleRegistry {
  const edition: ResolvedEdition = {
    id: 'test',
    modules: [
      {
        manifest: {
          id: 'iam',
          name: 'IAM',
          category: 'foundation',
          dependencies: [],
          optionalDependencies: [],
          capabilities: [{ id: 'iam.authorization', name: '角色与权限' }],
          dataScopeProviders: [{ id: 'organization' }],
          permissions: [
            { code: 'iam.role.view', name: '查看角色' },
            { code: 'iam.role.manage', name: '管理角色' },
            {
              code: 'example.scope',
              name: '带范围',
              dataScope: {
                allowedTypes: ['ALL', 'ORGANIZATION', 'ORGANIZATION_AND_DESCENDANTS', 'CUSTOM'],
                provider: 'organization',
              },
            },
          ],
          routeDefinitions: [],
        },
        enabledCapabilities: new Set(['iam.authorization']),
      },
    ],
  }
  return new ModuleRegistry(edition)
}

function createManage(
  store: MemoryRoleStore,
  registry = createRegistry(),
  facts: OrganizationalScopeFacts = {
    memberOrgUnitIds: () => Promise.resolve([]),
    descendantsOf: (_tenantId, ids) => Promise.resolve(ids),
    validOrgUnitIds: (_tenantId, ids) => Promise.resolve(ids),
  },
) {
  const access: IamAccess = {
    activeRoleIds: () => Promise.resolve([]),
    roles: () => Promise.resolve([]),
    effectivePermissionCodes: () => Promise.resolve([]),
    requireUnscopedPermission: () => Promise.resolve(),
  }
  const work: RoleUnitOfWork = {
    run<T>(work: (transaction: RoleTransaction) => Promise<T>) {
      return work({ store, record: () => Promise.resolve() })
    },
  }
  return new ManageIamRoles(
    store,
    work,
    access,
    registry,
    new ReadPermissionCatalog(registry),
    facts,
  )
}

describe('ManageIamRoles', () => {
  it('creates roles with tenant-unique code and immutable identity fields', async () => {
    const store = new MemoryRoleStore()
    const manage = createManage(store)
    const created = await manage.create(context, {
      code: 'ops',
      name: '运维',
      description: '值班角色',
    })
    expect(created.status).toBe('ACTIVE')
    expect(created.isSystem).toBe(false)
    await expect(manage.create(context, { code: 'ops', name: '重复' })).rejects.toMatchObject({
      code: 'IAM_ROLE_CODE_CONFLICT',
    })
  })

  it('blocks deleting system roles and roles with assignments', async () => {
    const store = new MemoryRoleStore()
    const manage = createManage(store)
    const systemRole = await manage.create(context, { code: 'admin', name: '管理员' })
    store.roles.set(systemRole.id, { ...systemRole, isSystem: true })
    await expect(manage.remove(context, systemRole.id)).rejects.toMatchObject({
      code: 'IAM_ROLE_SYSTEM_PROTECTED',
    })

    const normal = await manage.create(context, { code: 'viewer', name: '只读' })
    store.assigned.add(normal.id)
    await expect(manage.remove(context, normal.id)).rejects.toMatchObject({
      code: 'IAM_ROLE_HAS_ASSIGNMENTS',
    })
    store.assigned.delete(normal.id)
    await expect(manage.remove(context, normal.id)).resolves.toEqual({ id: normal.id })
  })

  it('lists edition permissions and rejects unknown or over-scoped grants', async () => {
    const store = new MemoryRoleStore()
    const manage = createManage(store)
    const catalog = await manage.listPermissions(context)
    expect(catalog.permissions.map((item) => item.code)).toEqual([
      'example.scope',
      'iam.role.manage',
      'iam.role.view',
    ])

    const role = await manage.create(context, { code: 'ops', name: '运维' })
    await expect(
      manage.replacePermissions(context, role.id, {
        permissions: [{ permissionCode: 'missing.permission', scopeType: 'ALL' }],
      }),
    ).rejects.toMatchObject({ code: 'IAM_PERMISSION_UNKNOWN' })

    await expect(
      manage.replacePermissions(context, role.id, {
        permissions: [{ permissionCode: 'iam.role.view', scopeType: 'SELF' }],
      }),
    ).rejects.toMatchObject({ code: 'IAM_PERMISSION_SCOPE_UNSUPPORTED' })

    const replaced = await manage.replacePermissions(context, role.id, {
      permissions: [
        { permissionCode: 'iam.role.view', scopeType: 'ALL' },
        { permissionCode: 'example.scope', scopeType: 'ORGANIZATION' },
      ],
    })
    expect(replaced.permissions).toHaveLength(2)
    await expect(
      manage.replacePermissions(context, role.id, {
        permissions: [
          { permissionCode: 'iam.role.view', scopeType: 'ALL' },
          { permissionCode: 'iam.role.view', scopeType: 'ALL' },
        ],
      }),
    ).rejects.toMatchObject({ code: 'IAM_ROLE_PERMISSION_DUPLICATE' })
  })

  it('accepts CUSTOM scope with org ids and rejects empty custom lists', async () => {
    const store = new MemoryRoleStore()
    const manage = createManage(store)
    const role = await manage.create(context, { code: 'scoped', name: '范围角色' })
    const orgId = newUserId()
    await expect(
      manage.replacePermissions(context, role.id, {
        permissions: [{ permissionCode: 'example.scope', scopeType: 'CUSTOM' }],
      }),
    ).rejects.toMatchObject({ code: 'IAM_PERMISSION_SCOPE_CUSTOM_EMPTY' })

    const replaced = await manage.replacePermissions(context, role.id, {
      permissions: [
        {
          permissionCode: 'example.scope',
          scopeType: 'CUSTOM',
          organizationIds: [orgId],
        },
      ],
    })
    expect(replaced.permissions[0]).toMatchObject({
      permissionCode: 'example.scope',
      scopeType: 'CUSTOM',
      organizationIds: [orgId],
    })

    await expect(
      manage.replacePermissions(context, role.id, {
        permissions: [
          {
            permissionCode: 'example.scope',
            scopeType: 'CUSTOM',
            organizationIds: [orgId, orgId],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'IAM_PERMISSION_SCOPE_CUSTOM_DUPLICATE' })
  })

  it('rejects scope types outside the permission contract and invalid custom organizations', async () => {
    const store = new MemoryRoleStore()
    const facts: OrganizationalScopeFacts = {
      memberOrgUnitIds: () => Promise.resolve([]),
      descendantsOf: (_tenantId, ids) => Promise.resolve(ids),
      validOrgUnitIds: () => Promise.resolve([]),
    }
    const manage = createManage(store, createRegistry(), facts)
    const role = await manage.create(context, { code: 'bounded', name: '受限角色' })
    await expect(
      manage.replacePermissions(context, role.id, {
        permissions: [{ permissionCode: 'example.scope', scopeType: 'SELF' }],
      }),
    ).rejects.toMatchObject({ code: 'IAM_PERMISSION_SCOPE_UNSUPPORTED' })
    await expect(
      manage.replacePermissions(context, role.id, {
        permissions: [
          {
            permissionCode: 'example.scope',
            scopeType: 'CUSTOM',
            organizationIds: [newUserId()],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'IAM_PERMISSION_SCOPE_ORGANIZATION_INVALID' })
  })

  it('updates name/status without touching code', async () => {
    const store = new MemoryRoleStore()
    const manage = createManage(store)
    const role = await manage.create(context, { code: 'ops', name: '运维' })
    const updated = await manage.update(context, role.id, {
      name: '运维值班',
      status: 'DISABLED',
    })
    expect(updated.code).toBe('ops')
    expect(updated.name).toBe('运维值班')
    expect(updated.status).toBe('DISABLED')
  })
})
