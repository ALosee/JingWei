import { describe, expect, it } from 'vitest'

import {
  newRequestId,
  newSessionId,
  newTenantId,
  newUserId,
  type ApplicationContext,
  type AuthContext,
} from '@jingwei/kernel'
import type { AuthorizationEvaluator, IamAccess } from '@jingwei/module-iam/server/public'

import type { OrganizationPosition, UpdateOrganizationPosition } from '../../shared/index.js'
import { ManageOrganizationPositions } from './manage-positions.js'
import type { PositionStore, PositionUnitOfWork, PositionTransaction } from './position-store.js'

const context: AuthContext = {
  requestId: newRequestId(),
  tenantId: newTenantId(),
  userId: newUserId(),
  sessionId: newSessionId(),
  roleIds: [],
}

const unitId = newUserId()

class MemoryPositionStore implements PositionStore {
  positions = new Map<string, OrganizationPosition>()
  units = new Set<string>([unitId])
  members = new Set<string>()

  listByUnit(_tenantId: string, orgUnitId: string) {
    return Promise.resolve([...this.positions.values()].filter((p) => p.orgUnitId === orgUnitId))
  }
  get(_tenantId: string, id: string) {
    return Promise.resolve(this.positions.get(id) ?? null)
  }
  unitExists(_tenantId: string, orgUnitId: string) {
    return Promise.resolve(this.units.has(orgUnitId))
  }
  codeTaken(_tenantId: string, orgUnitId: string, code: string, exceptId?: string) {
    for (const item of this.positions.values()) {
      if (item.orgUnitId === orgUnitId && item.code === code && item.id !== exceptId) {
        return Promise.resolve(true)
      }
    }
    return Promise.resolve(false)
  }
  hasMembers(_tenantId: string, id: string) {
    return Promise.resolve(this.members.has(id))
  }
  insert(_context: ApplicationContext, position: OrganizationPosition) {
    this.positions.set(position.id, position)
    return Promise.resolve()
  }
  update(_context: ApplicationContext, id: string, patch: UpdateOrganizationPosition) {
    const existing = this.positions.get(id)
    if (existing === undefined) return Promise.resolve()
    this.positions.set(id, {
      ...existing,
      ...(patch.code === undefined ? {} : { code: patch.code }),
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.status === undefined ? {} : { status: patch.status }),
      ...(patch.sortOrder === undefined ? {} : { sortOrder: patch.sortOrder }),
    })
    return Promise.resolve()
  }
  delete(_context: ApplicationContext, id: string) {
    this.positions.delete(id)
    return Promise.resolve()
  }
}

function createManage(
  store: MemoryPositionStore,
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
  const work: PositionUnitOfWork = {
    run<T>(work: (transaction: PositionTransaction) => Promise<T>) {
      return work({ store, record: () => Promise.resolve() })
    },
  }
  return new ManageOrganizationPositions(store, work, access, evaluator)
}

describe('ManageOrganizationPositions', () => {
  it('creates and lists positions under a unit', async () => {
    const store = new MemoryPositionStore()
    const manage = createManage(store)
    const created = await manage.create(context, unitId, {
      code: 'rd-manager',
      name: '研发经理',
    })
    expect(created.orgUnitId).toBe(unitId)
    expect(created.status).toBe('ENABLED')
    const list = await manage.listByUnit(context, unitId)
    expect(list.positions).toHaveLength(1)
  })

  it('rejects duplicate code in the same unit', async () => {
    const store = new MemoryPositionStore()
    const manage = createManage(store)
    await manage.create(context, unitId, { code: 'rd', name: '研发' })
    await expect(
      manage.create(context, unitId, { code: 'rd', name: '重复' }),
    ).rejects.toMatchObject({ code: 'ORGANIZATION_POSITION_CODE_CONFLICT' })
  })

  it('blocks delete when members still hold the position', async () => {
    const store = new MemoryPositionStore()
    const manage = createManage(store)
    const created = await manage.create(context, unitId, { code: 'rd', name: '研发' })
    store.members.add(created.id)
    await expect(manage.remove(context, unitId, created.id)).rejects.toMatchObject({
      code: 'ORGANIZATION_POSITION_HAS_MEMBERS',
    })
    store.members.delete(created.id)
    await expect(manage.remove(context, unitId, created.id)).resolves.toEqual({ id: created.id })
  })

  it('returns 404 for unknown unit or position', async () => {
    const store = new MemoryPositionStore()
    const manage = createManage(store)
    await expect(manage.listByUnit(context, 'missing-unit')).rejects.toMatchObject({
      code: 'ORGANIZATION_UNIT_NOT_FOUND',
    })
    await expect(manage.update(context, unitId, 'missing', { name: 'x' })).rejects.toMatchObject({
      code: 'ORGANIZATION_POSITION_NOT_FOUND',
    })
  })

  it('rejects a position addressed through the wrong organization unit', async () => {
    const store = new MemoryPositionStore()
    const manage = createManage(store)
    const created = await manage.create(context, unitId, { code: 'rd', name: '研发' })
    const otherUnitId = newUserId()
    store.units.add(otherUnitId)

    await expect(
      manage.update(context, otherUnitId, created.id, { name: '误更新' }),
    ).rejects.toMatchObject({ code: 'ORGANIZATION_POSITION_NOT_FOUND' })
    await expect(manage.remove(context, otherUnitId, created.id)).rejects.toMatchObject({
      code: 'ORGANIZATION_POSITION_NOT_FOUND',
    })
    expect(store.positions.get(created.id)?.name).toBe('研发')
  })

  it('denies listByUnit when the unit is outside data scope', async () => {
    const store = new MemoryPositionStore()
    store.units.add(unitId)
    const manage = createManage(store, {
      requireScopedPermission: () =>
        Promise.resolve({
          type: 'ORGANIZATION',
          organizationIds: ['other-unit'],
          includeSelf: false,
        }),
    })
    await expect(manage.listByUnit(context, unitId)).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    })
  })
})
