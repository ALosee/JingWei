import { describe, expect, it } from 'vitest'

import {
  ApplicationError,
  newRequestId,
  newSessionId,
  newTenantId,
  newUserId,
  type ApplicationContext,
  type AuthContext,
} from '@jingwei/kernel'
import type { AuthorizationEvaluator, IamAccess } from '@jingwei/module-iam/server/public'

import type { OrganizationUnit, UpdateOrganizationUnit } from '../../shared/index.js'
import { ManageOrganizationUnits } from './manage-org-units.js'
import type { OrgUnitStore, OrgUnitOfWork, OrgUnitTransaction } from './org-unit-store.js'

const context: AuthContext = {
  requestId: newRequestId(),
  tenantId: newTenantId(),
  userId: newUserId(),
  sessionId: newSessionId(),
  roleIds: [],
}

function unit(partial: Partial<OrganizationUnit> & Pick<OrganizationUnit, 'id'>): OrganizationUnit {
  return {
    parentId: null,
    code: partial.id,
    name: partial.id,
    type: 'DEPARTMENT',
    status: 'ENABLED',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

class MemoryStore implements OrgUnitStore {
  units = new Map<string, OrganizationUnit>()
  members = new Set<string>()
  positions = new Set<string>()
  listCalls = 0
  visibleTreeCalls = 0

  list() {
    this.listCalls += 1
    return Promise.resolve([...this.units.values()])
  }
  listVisibleTree(_tenantId: string, organizationIds: readonly string[]) {
    this.visibleTreeCalls += 1
    const visible = new Set<string>()
    for (const id of organizationIds) {
      let current = this.units.get(id)
      while (current !== undefined) {
        visible.add(current.id)
        current = current.parentId === null ? undefined : this.units.get(current.parentId)
      }
    }
    return Promise.resolve([...this.units.values()].filter((item) => visible.has(item.id)))
  }
  get(_tenantId: string, id: string) {
    return Promise.resolve(this.units.get(id) ?? null)
  }
  exists(_tenantId: string, id: string) {
    return Promise.resolve(this.units.has(id))
  }
  codeTaken(_tenantId: string, code: string, exceptId?: string) {
    for (const item of this.units.values()) {
      if (item.code === code && item.id !== exceptId) return Promise.resolve(true)
    }
    return Promise.resolve(false)
  }
  hasChildren(_tenantId: string, id: string) {
    for (const item of this.units.values()) if (item.parentId === id) return Promise.resolve(true)
    return Promise.resolve(false)
  }
  hasMembers(_tenantId: string, id: string) {
    return Promise.resolve(this.members.has(id))
  }
  hasPositions(_tenantId: string, id: string) {
    return Promise.resolve(this.positions.has(id))
  }
  isDescendant(_tenantId: string, rootId: string, candidateId: string) {
    const children = new Map<string, string[]>()
    for (const item of this.units.values()) {
      if (item.parentId === null) continue
      const bucket = children.get(item.parentId)
      if (bucket === undefined) children.set(item.parentId, [item.id])
      else bucket.push(item.id)
    }
    const stack = [...(children.get(rootId) ?? [])]
    while (stack.length > 0) {
      const current = stack.pop()
      if (current === undefined) continue
      if (current === candidateId) return Promise.resolve(true)
      stack.push(...(children.get(current) ?? []))
    }
    return Promise.resolve(false)
  }
  insert(_context: ApplicationContext, value: OrganizationUnit) {
    this.units.set(value.id, value)
    return Promise.resolve()
  }
  update(
    _context: ApplicationContext,
    id: string,
    patch: UpdateOrganizationUnit & { updatedAt: Date },
  ) {
    const existing = this.units.get(id)
    if (existing === undefined) return Promise.resolve()
    this.units.set(id, {
      ...existing,
      ...(patch.parentId === undefined ? {} : { parentId: patch.parentId }),
      ...(patch.code === undefined ? {} : { code: patch.code }),
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.type === undefined ? {} : { type: patch.type }),
      ...(patch.status === undefined ? {} : { status: patch.status }),
      ...(patch.sortOrder === undefined ? {} : { sortOrder: patch.sortOrder }),
      updatedAt: patch.updatedAt.toISOString(),
    })
    return Promise.resolve()
  }
  delete(_context: ApplicationContext, id: string) {
    this.units.delete(id)
    return Promise.resolve()
  }
}

function createManage(
  store: MemoryStore,
  evaluator: AuthorizationEvaluator = {
    requireScopedPermission: () =>
      Promise.resolve({ type: 'ALL', organizationIds: [], includeSelf: false }),
  },
) {
  const access: IamAccess = {
    activeRoleIds: () => Promise.resolve([]),
    roles: () => Promise.resolve([]),
    effectivePermissionCodes: () => Promise.resolve([]),
    requireUnscopedPermission: () => Promise.resolve(),
  }
  const work: OrgUnitOfWork = {
    run<T>(work: (transaction: OrgUnitTransaction) => Promise<T>) {
      return work({
        store,
        record: () => Promise.resolve(),
      })
    },
  }
  return new ManageOrganizationUnits(store, work, access, evaluator)
}

describe('ManageOrganizationUnits', () => {
  it('creates a root unit with defaults', async () => {
    const store = new MemoryStore()
    const manage = createManage(store)
    const created = await manage.create(context, {
      parentId: null,
      code: 'hq',
      name: '总部',
      type: 'COMPANY',
    })
    expect(created.status).toBe('ENABLED')
    expect(store.units.get(created.id)?.code).toBe('hq')
  })

  it('rejects duplicate codes in the same tenant', async () => {
    const store = new MemoryStore()
    store.units.set('a', unit({ id: 'a', code: 'hq', name: '总部' }))
    const manage = createManage(store)
    await expect(
      manage.create(context, { parentId: null, code: 'hq', name: '重复', type: 'DEPARTMENT' }),
    ).rejects.toMatchObject({ code: 'ORGANIZATION_CODE_CONFLICT' })
  })

  it('rejects moving a node under itself or its descendants', async () => {
    const store = new MemoryStore()
    store.units.set('root', unit({ id: 'root', parentId: null, code: 'root' }))
    store.units.set('child', unit({ id: 'child', parentId: 'root', code: 'child' }))
    store.units.set('grand', unit({ id: 'grand', parentId: 'child', code: 'grand' }))
    const manage = createManage(store)
    await expect(manage.update(context, 'root', { parentId: 'grand' })).rejects.toMatchObject({
      code: 'ORGANIZATION_MOVE_CYCLE',
    })
    await expect(manage.update(context, 'root', { parentId: 'root' })).rejects.toMatchObject({
      code: 'ORGANIZATION_MOVE_CYCLE',
    })
  })

  it('blocks delete when children, members or positions remain', async () => {
    const store = new MemoryStore()
    store.units.set('root', unit({ id: 'root' }))
    store.units.set('child', unit({ id: 'child', parentId: 'root' }))
    const manage = createManage(store)
    await expect(manage.remove(context, 'root')).rejects.toMatchObject({
      code: 'ORGANIZATION_HAS_CHILDREN',
    })
    store.units.delete('child')
    store.members.add('root')
    await expect(manage.remove(context, 'root')).rejects.toMatchObject({
      code: 'ORGANIZATION_HAS_MEMBERS',
    })
    store.members.delete('root')
    store.positions.add('root')
    await expect(manage.remove(context, 'root')).rejects.toMatchObject({
      code: 'ORGANIZATION_HAS_POSITIONS',
    })
    store.positions.delete('root')
    await expect(manage.remove(context, 'root')).resolves.toEqual({ id: 'root' })
  })

  it('returns 404 for unknown units', async () => {
    const store = new MemoryStore()
    const manage = createManage(store)
    const error = await manage
      .update(context, 'missing', { name: 'x' })
      .catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(ApplicationError)
    expect((error as ApplicationError).status).toBe(404)
  })

  it('filters the tree by organization data scope and keeps ancestors', async () => {
    const store = new MemoryStore()
    store.units.set('root', unit({ id: 'root', parentId: null, code: 'root' }))
    store.units.set('dept', unit({ id: 'dept', parentId: 'root', code: 'dept' }))
    store.units.set('team', unit({ id: 'team', parentId: 'dept', code: 'team' }))
    store.units.set('other', unit({ id: 'other', parentId: 'root', code: 'other' }))
    const manage = createManage(store, {
      requireScopedPermission: () =>
        Promise.resolve({
          type: 'ORGANIZATION_AND_DESCENDANTS',
          organizationIds: ['team'],
          includeSelf: false,
        }),
    })
    const { units } = await manage.tree(context)
    expect(units.map((item) => item.id).toSorted()).toEqual(['dept', 'root', 'team'])
    expect(store.listCalls).toBe(0)
    expect(store.visibleTreeCalls).toBe(1)
  })

  it('denies tree when evaluator rejects', async () => {
    const store = new MemoryStore()
    const manage = createManage(store, {
      requireScopedPermission: () =>
        Promise.reject(
          new ApplicationError({
            code: 'PERMISSION_DENIED',
            message: '没有执行此操作的功能权限',
            status: 403,
          }),
        ),
    })
    await expect(manage.tree(context)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
  })
})
