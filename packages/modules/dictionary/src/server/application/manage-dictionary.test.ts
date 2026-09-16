import { describe, expect, it, vi } from 'vitest'

import {
  ApplicationError,
  newRequestId,
  newSessionId,
  newTenantId,
  newUserId,
  type ApplicationContext,
  type AuthContext,
} from '@jingwei/kernel'
import type { IamAccess } from '@jingwei/module-iam/server/public'

import type {
  DictionaryCategory,
  DictionaryItem,
  DictionaryStatus,
  DictionaryType,
} from '../../shared/index.js'
import { PostgresDictionaryStore } from '../infrastructure/dictionary-store.pg.js'
import { createDictionaryQuery } from '../public/create-query.js'
import type {
  DictionaryStore,
  DictionaryTransaction,
  DictionaryUnitOfWork,
} from './dictionary-store.js'
import { ManageDictionary } from './manage-dictionary.js'

const context: AuthContext = {
  requestId: newRequestId(),
  tenantId: newTenantId(),
  userId: newUserId(),
  sessionId: newSessionId(),
  roleIds: [],
}

class MemoryDictionaryStore implements DictionaryStore {
  categories = new Map<string, DictionaryCategory>()
  types = new Map<string, DictionaryType>()
  items = new Map<string, DictionaryItem>()

  listCategories() {
    return Promise.resolve([...this.categories.values()])
  }
  category(_tenantId: string, id: string) {
    return Promise.resolve(this.categories.get(id) ?? null)
  }
  categoryCodeTaken(_tenantId: string, code: string) {
    return Promise.resolve([...this.categories.values()].some((item) => item.code === code))
  }
  categoryCount() {
    return Promise.resolve(this.categories.size)
  }
  categoryHasTypes(_tenantId: string, id: string) {
    return Promise.resolve([...this.types.values()].some((item) => item.categoryId === id))
  }
  insertCategory(_context: ApplicationContext, category: DictionaryCategory) {
    this.categories.set(category.id, category)
    return Promise.resolve()
  }
  updateCategory(
    _context: ApplicationContext,
    id: string,
    patch: { name?: string; sortOrder?: number; updatedAt: Date },
    expectedRevision: number,
  ) {
    const existing = this.categories.get(id)
    if (existing?.revision !== expectedRevision) return Promise.resolve(false)
    this.categories.set(id, {
      ...existing,
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.sortOrder === undefined ? {} : { sortOrder: patch.sortOrder }),
      revision: existing.revision + 1,
      updatedAt: patch.updatedAt.toISOString(),
    })
    return Promise.resolve(true)
  }
  deleteCategory(_tenantId: string, id: string, expectedRevision: number) {
    const existing = this.categories.get(id)
    if (existing?.revision !== expectedRevision) return Promise.resolve(false)
    this.categories.delete(id)
    return Promise.resolve(true)
  }
  listTypes() {
    return Promise.resolve([...this.types.values()])
  }
  type(_tenantId: string, id: string) {
    return Promise.resolve(this.types.get(id) ?? null)
  }
  typeByCode(_tenantId: string, code: string) {
    return Promise.resolve([...this.types.values()].find((item) => item.code === code) ?? null)
  }
  async typeCodeTaken(tenantId: string, code: string) {
    return (await this.typeByCode(tenantId, code)) !== null
  }
  typeCount() {
    return Promise.resolve(this.types.size)
  }
  insertType(_context: ApplicationContext, type: DictionaryType) {
    this.types.set(type.id, type)
    return Promise.resolve()
  }
  updateType(
    _context: ApplicationContext,
    id: string,
    patch: {
      categoryId?: string
      name?: string
      status?: DictionaryStatus
      updatedAt: Date
    },
    expectedRevision: number,
  ) {
    const existing = this.types.get(id)
    if (existing?.revision !== expectedRevision) return Promise.resolve(false)
    this.types.set(id, {
      ...existing,
      ...(patch.categoryId === undefined ? {} : { categoryId: patch.categoryId }),
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.status === undefined ? {} : { status: patch.status }),
      revision: existing.revision + 1,
      updatedAt: patch.updatedAt.toISOString(),
    })
    return Promise.resolve(true)
  }
  touchType(_context: ApplicationContext, id: string, expectedRevision: number, updatedAt: Date) {
    const existing = this.types.get(id)
    if (existing?.revision !== expectedRevision) return Promise.resolve(false)
    this.types.set(id, {
      ...existing,
      revision: existing.revision + 1,
      updatedAt: updatedAt.toISOString(),
    })
    return Promise.resolve(true)
  }
  listItems(_tenantId: string, typeId: string) {
    return Promise.resolve(
      [...this.items.values()]
        .filter((item) => item.typeId === typeId)
        .toSorted(
          (left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code),
        ),
    )
  }
  item(_tenantId: string, typeId: string, id: string) {
    const item = this.items.get(id)
    return Promise.resolve(item?.typeId === typeId ? item : null)
  }
  itemCodeTaken(_tenantId: string, typeId: string, code: string) {
    return Promise.resolve(
      [...this.items.values()].some((item) => item.typeId === typeId && item.code === code),
    )
  }
  itemCount(_tenantId: string, typeId: string) {
    return Promise.resolve([...this.items.values()].filter((item) => item.typeId === typeId).length)
  }
  insertItem(_context: ApplicationContext, item: DictionaryItem) {
    this.items.set(item.id, item)
    return Promise.resolve()
  }
  updateItem(
    _context: ApplicationContext,
    typeId: string,
    id: string,
    patch: {
      label?: string
      status?: DictionaryStatus
      sortOrder?: number
      updatedAt: Date
    },
  ) {
    const existing = this.items.get(id)
    if (existing?.typeId !== typeId) return Promise.resolve()
    this.items.set(id, {
      ...existing,
      ...(patch.label === undefined ? {} : { label: patch.label }),
      ...(patch.status === undefined ? {} : { status: patch.status }),
      ...(patch.sortOrder === undefined ? {} : { sortOrder: patch.sortOrder }),
      updatedAt: patch.updatedAt.toISOString(),
    })
    return Promise.resolve()
  }
}

function createManage(store: MemoryDictionaryStore, access?: Partial<IamAccess>) {
  const resolved: IamAccess = {
    activeRoleIds: () => Promise.resolve([]),
    roles: () => Promise.resolve([]),
    effectivePermissionCodes: () => Promise.resolve([]),
    requireUnscopedPermission: () => Promise.resolve(),
    ...access,
  }
  const work: DictionaryUnitOfWork = {
    run<T>(operation: (transaction: DictionaryTransaction) => Promise<T>) {
      return operation({
        store,
        record: () => Promise.resolve(),
      })
    },
  }
  return { manage: new ManageDictionary(store, work, resolved) }
}

function seedCategory(store: MemoryDictionaryStore, index: number) {
  const category: DictionaryCategory = {
    id: `category-${index}`,
    code: `category.${index}`,
    name: `分类 ${index}`,
    sortOrder: index,
    revision: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
  store.categories.set(category.id, category)
  return category
}

function seedType(store: MemoryDictionaryStore, index: number, categoryId = 'category-0') {
  const type: DictionaryType = {
    id: `type-${index}`,
    categoryId,
    code: `type.${index}`,
    name: `类型 ${index}`,
    status: 'ENABLED',
    revision: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
  store.types.set(type.id, type)
  return type
}

function seedItem(store: MemoryDictionaryStore, typeId: string, index: number) {
  const item: DictionaryItem = {
    id: `item-${typeId}-${index}`,
    typeId,
    code: `item.${index}`,
    label: `条目 ${index}`,
    status: index % 2 === 0 ? 'ENABLED' : 'DISABLED',
    sortOrder: index,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
  store.items.set(item.id, item)
  return item
}

async function createCategoryAndType(manage: ManageDictionary) {
  const category = await manage.createCategory(context, {
    code: 'common',
    name: '通用数据',
  })
  const detail = await manage.createType(context, {
    categoryId: category.id,
    code: 'common.gender',
    name: '性别',
  })
  return { category, detail }
}

describe('ManageDictionary', () => {
  it('creates category, type and item while advancing the type revision', async () => {
    const store = new MemoryDictionaryStore()
    const { manage } = createManage(store)
    const { category, detail } = await createCategoryAndType(manage)

    const updated = await manage.createItem(context, detail.type.id, {
      code: 'female',
      label: '女',
      sortOrder: 10,
      expectedRevision: detail.type.revision,
    })

    expect(category.code).toBe('common')
    expect(updated.type.revision).toBe(2)
    expect(updated.items).toMatchObject([{ code: 'female', label: '女', status: 'ENABLED' }])
  })

  it('rejects stale revisions for item changes', async () => {
    const store = new MemoryDictionaryStore()
    const { manage } = createManage(store)
    const { detail } = await createCategoryAndType(manage)
    const current = await manage.createItem(context, detail.type.id, {
      code: 'female',
      label: '女',
      expectedRevision: 1,
    })

    const [item] = current.items
    if (item === undefined) throw new Error('Expected the created dictionary item')
    await expect(
      manage.updateItem(context, detail.type.id, item.id, {
        label: '女性',
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ code: 'DICTIONARY_REVISION_CONFLICT' })
  })

  it('only deletes empty categories and keeps type codes stable when moving', async () => {
    const store = new MemoryDictionaryStore()
    const { manage } = createManage(store)
    const { category, detail } = await createCategoryAndType(manage)
    const target = await manage.createCategory(context, { code: 'profile', name: '用户资料' })

    await expect(
      manage.deleteCategory(context, category.id, category.revision),
    ).rejects.toMatchObject({ code: 'DICTIONARY_CATEGORY_NOT_EMPTY' })

    const moved = await manage.updateType(context, detail.type.id, {
      categoryId: target.id,
      expectedRevision: detail.type.revision,
    })
    expect(moved.type.categoryId).toBe(target.id)
    expect(moved.type.code).toBe('common.gender')
    await expect(manage.deleteCategory(context, category.id, category.revision)).resolves.toEqual({
      id: category.id,
    })
  })

  it('rejects duplicate category, type and item codes', async () => {
    const store = new MemoryDictionaryStore()
    const { manage } = createManage(store)
    const { category, detail } = await createCategoryAndType(manage)

    await expect(
      manage.createCategory(context, { code: category.code, name: '重复分类' }),
    ).rejects.toMatchObject({ code: 'DICTIONARY_CATEGORY_CODE_CONFLICT' })
    await expect(
      manage.createType(context, {
        categoryId: category.id,
        code: detail.type.code,
        name: '重复类型',
      }),
    ).rejects.toMatchObject({ code: 'DICTIONARY_TYPE_CODE_CONFLICT' })
    await expect(
      manage.createItem(context, detail.type.id, {
        code: 'female',
        label: '女',
        expectedRevision: detail.type.revision,
      }),
    ).resolves.toMatchObject({ type: { code: 'common.gender' } })
    await expect(
      manage.createItem(context, detail.type.id, {
        code: 'female',
        label: '女',
        expectedRevision: 2,
      }),
    ).rejects.toMatchObject({ code: 'DICTIONARY_ITEM_CODE_CONFLICT' })
  })

  it('enforces category, type and item limits', async () => {
    const store = new MemoryDictionaryStore()
    for (let index = 0; index < 100; index += 1) seedCategory(store, index)
    seedType(store, 0)
    for (let index = 0; index < 500; index += 1) seedType(store, index)
    for (let index = 0; index < 1_000; index += 1) seedItem(store, 'type-0', index)

    const { manage } = createManage(store)
    await expect(
      manage.createCategory(context, { code: 'overflow', name: '超限' }),
    ).rejects.toMatchObject({ code: 'DICTIONARY_CATEGORY_LIMIT_EXCEEDED' })
    await expect(
      manage.createType(context, { categoryId: 'category-0', code: 'overflow', name: '超限' }),
    ).rejects.toMatchObject({ code: 'DICTIONARY_TYPE_LIMIT_EXCEEDED' })
    await expect(
      manage.createItem(context, 'type-0', {
        code: 'overflow',
        label: '超限',
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ code: 'DICTIONARY_ITEM_LIMIT_EXCEEDED' })
  })

  it('rejects manage actions without dictionary.manage', async () => {
    const store = new MemoryDictionaryStore()
    const { manage } = createManage(store, {
      requireUnscopedPermission: () =>
        Promise.reject(
          new ApplicationError({
            code: 'PERMISSION_DENIED',
            message: '没有执行此操作的功能权限',
            status: 403,
          }),
        ),
    })

    await expect(manage.catalog(context)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
    await expect(manage.createCategory(context, { code: 'x', name: 'x' })).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
      status: 403,
    })
  })

  it('locks the target category when creating or moving a type', async () => {
    const store = new MemoryDictionaryStore()
    const categorySpy = vi.spyOn(store, 'category')
    const { manage } = createManage(store)
    const source = await manage.createCategory(context, { code: 'common', name: '通用数据' })
    const target = await manage.createCategory(context, { code: 'profile', name: '用户资料' })
    const detail = await manage.createType(context, {
      categoryId: source.id,
      code: 'common.gender',
      name: '性别',
    })

    expect(categorySpy).toHaveBeenCalledWith(context.tenantId, source.id, true)

    categorySpy.mockClear()
    await manage.updateType(context, detail.type.id, {
      categoryId: target.id,
      expectedRevision: detail.type.revision,
    })
    expect(categorySpy).toHaveBeenCalledWith(context.tenantId, target.id, true)
  })

  it('does not bump revision when type, category or item fields are unchanged', async () => {
    const store = new MemoryDictionaryStore()
    const { manage } = createManage(store)
    const { category, detail } = await createCategoryAndType(manage)
    const created = await manage.createItem(context, detail.type.id, {
      code: 'female',
      label: '女',
      expectedRevision: detail.type.revision,
    })
    const item = created.items[0]
    if (item === undefined) throw new Error('Expected the created dictionary item')
    const revisionAfterCreate = created.type.revision

    const noopCategory = await manage.updateCategory(context, category.id, {
      name: category.name,
      sortOrder: category.sortOrder,
      expectedRevision: category.revision,
    })
    expect(noopCategory.revision).toBe(category.revision)

    const noopType = await manage.updateType(context, detail.type.id, {
      categoryId: detail.type.categoryId,
      name: detail.type.name,
      status: detail.type.status,
      expectedRevision: revisionAfterCreate,
    })
    expect(noopType.type.revision).toBe(revisionAfterCreate)

    const noopItem = await manage.updateItem(context, detail.type.id, item.id, {
      label: item.label,
      status: item.status,
      sortOrder: item.sortOrder,
      expectedRevision: revisionAfterCreate,
    })
    expect(noopItem.type.revision).toBe(revisionAfterCreate)
  })
})

describe('PostgresDictionaryStore unique conflicts', () => {
  function storeRejectingUniqueViolation() {
    const executeTakeFirstOrThrow = vi.fn().mockRejectedValue(
      Object.assign(new Error('duplicate key value violates unique constraint'), {
        code: '23505',
      }),
    )
    const db = {
      insertInto: () => ({
        values: () => ({ executeTakeFirstOrThrow }),
      }),
    }
    return new PostgresDictionaryStore(db as never)
  }

  it('maps category, type and item unique violations to stable 409 codes', async () => {
    const store = storeRejectingUniqueViolation()
    const now = new Date().toISOString()

    await expect(
      store.insertCategory(context, {
        id: 'c1',
        code: 'common',
        name: '通用',
        sortOrder: 0,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toMatchObject({ code: 'DICTIONARY_CATEGORY_CODE_CONFLICT', status: 409 })

    await expect(
      store.insertType(context, {
        id: 't1',
        categoryId: 'c1',
        code: 'common.gender',
        name: '性别',
        status: 'ENABLED',
        revision: 1,
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toMatchObject({ code: 'DICTIONARY_TYPE_CODE_CONFLICT', status: 409 })

    await expect(
      store.insertItem(context, {
        id: 'i1',
        typeId: 't1',
        code: 'female',
        label: '女',
        status: 'ENABLED',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toMatchObject({ code: 'DICTIONARY_ITEM_CODE_CONFLICT', status: 409 })
  })
})

describe('createDictionaryQuery', () => {
  const tenantId = newTenantId()

  const type: DictionaryType = {
    id: 'type-query',
    categoryId: 'category-0',
    code: 'common.gender',
    name: '性别',
    status: 'ENABLED',
    revision: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
  const enabled: DictionaryItem = {
    id: 'item-enabled',
    typeId: type.id,
    code: 'female',
    label: '女',
    status: 'ENABLED',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
  const disabled: DictionaryItem = {
    id: 'item-disabled',
    typeId: type.id,
    code: 'unknown',
    label: '未知',
    status: 'DISABLED',
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  function installStoreStubs(currentType: DictionaryType | null, items: DictionaryItem[]) {
    const typeByCode = vi
      .spyOn(PostgresDictionaryStore.prototype, 'typeByCode')
      .mockImplementation((_tenant, code) =>
        Promise.resolve(currentType !== null && currentType.code === code ? currentType : null),
      )
    const listItems = vi
      .spyOn(PostgresDictionaryStore.prototype, 'listItems')
      .mockImplementation((_tenant, typeId) =>
        Promise.resolve(items.filter((item) => item.typeId === typeId)),
      )
    return { typeByCode, listItems }
  }

  function createQuery() {
    return createDictionaryQuery({ view: () => ({}) } as never)
  }

  it('returns a full snapshot including disabled items and type status', async () => {
    const stubs = installStoreStubs({ ...type, status: 'DISABLED' }, [enabled, disabled])

    const query = createQuery()
    await expect(query.getSnapshot(tenantId, type.code)).resolves.toEqual({
      code: type.code,
      name: type.name,
      enabled: false,
      revision: type.revision,
      items: [
        { code: enabled.code, label: enabled.label, enabled: true },
        { code: disabled.code, label: disabled.label, enabled: false },
      ],
    })
    stubs.typeByCode.mockRestore()
    stubs.listItems.mockRestore()
  })

  it('resolves known codes, keeps disabled labels and drops unknown codes', async () => {
    const stubs = installStoreStubs(type, [enabled, disabled])

    const query = createQuery()
    await expect(
      query.resolveItems(tenantId, type.code, [enabled.code, disabled.code, 'missing']),
    ).resolves.toEqual([
      { code: enabled.code, label: enabled.label, enabled: true },
      { code: disabled.code, label: disabled.label, enabled: false },
    ])
    await expect(query.resolveItems(tenantId, 'unknown.type', [enabled.code])).resolves.toEqual([])
    stubs.typeByCode.mockRestore()
    stubs.listItems.mockRestore()
  })
})
