import { ApplicationError, newEntityId, type AuthContext, type TenantId } from '@jingwei/kernel'
import type { IamAccess } from '@jingwei/module-iam/server/public'

import type {
  CreateDictionaryCategory,
  CreateDictionaryItem,
  CreateDictionaryType,
  DictionaryCategory,
  DictionaryCatalog,
  DictionaryTypeDetail,
  UpdateDictionaryCategory,
  UpdateDictionaryItem,
  UpdateDictionaryType,
} from '../../shared/index.js'
import type { DictionaryStore, DictionaryUnitOfWork } from './dictionary-store.js'

const CATEGORY_LIMIT = 100
const TYPE_LIMIT = 500
const ITEM_LIMIT = 1_000

function fail(code: string, message: string, status = 409): never {
  throw new ApplicationError({ code, message, status })
}

/** Application use cases own authorization, tenant scope, revisions and audit. */
export class ManageDictionary {
  constructor(
    private readonly store: DictionaryStore,
    private readonly work: DictionaryUnitOfWork,
    private readonly access: IamAccess,
  ) {}

  private authorize(context: AuthContext, action: 'view' | 'manage') {
    return this.access.requireUnscopedPermission(context, `dictionary.${action}`, 'dictionary.core')
  }

  async catalog(context: AuthContext): Promise<DictionaryCatalog> {
    await this.authorize(context, 'view')
    const [categories, types] = await Promise.all([
      this.store.listCategories(context.tenantId),
      this.store.listTypes(context.tenantId),
    ])
    return { categories, types }
  }

  async detail(context: AuthContext, id: string): Promise<DictionaryTypeDetail> {
    await this.authorize(context, 'view')
    return this.requiredDetail(this.store, context.tenantId, id)
  }

  async detailByCode(context: AuthContext, code: string): Promise<DictionaryTypeDetail> {
    await this.authorize(context, 'view')
    const type = await this.store.typeByCode(context.tenantId, code)
    if (type === null) fail('DICTIONARY_TYPE_NOT_FOUND', '字典类型不存在', 404)
    return { type, items: await this.store.listItems(context.tenantId, type.id) }
  }

  async createCategory(
    context: AuthContext,
    input: CreateDictionaryCategory,
  ): Promise<DictionaryCategory> {
    await this.authorize(context, 'manage')
    return this.work.run(async (tx) => {
      if ((await tx.store.categoryCount(context.tenantId)) >= CATEGORY_LIMIT)
        fail('DICTIONARY_CATEGORY_LIMIT_EXCEEDED', '字典分类数量已达上限')
      if (await tx.store.categoryCodeTaken(context.tenantId, input.code))
        fail('DICTIONARY_CATEGORY_CODE_CONFLICT', '字典分类编码已存在')
      const now = new Date()
      const category: DictionaryCategory = {
        id: newEntityId(),
        code: input.code,
        name: input.name,
        sortOrder: input.sortOrder ?? 0,
        revision: 1,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }
      await tx.store.insertCategory(context, category)
      await tx.record(
        context,
        'category_created',
        'dictionary_category',
        category.id,
        null,
        category,
      )
      return category
    })
  }

  async updateCategory(
    context: AuthContext,
    id: string,
    input: UpdateDictionaryCategory,
  ): Promise<DictionaryCategory> {
    await this.authorize(context, 'manage')
    return this.work.run(async (tx) => {
      const existing = await this.requiredCategory(tx.store, context.tenantId, id, true)
      this.assertRevision(existing.revision, input.expectedRevision)
      const name = input.name ?? existing.name
      const sortOrder = input.sortOrder ?? existing.sortOrder
      if (name === existing.name && sortOrder === existing.sortOrder) return existing
      const changed = await tx.store.updateCategory(
        context,
        id,
        {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
          updatedAt: new Date(),
        },
        input.expectedRevision,
      )
      if (!changed) this.revisionConflict()
      const updated = await this.requiredCategory(tx.store, context.tenantId, id)
      await tx.record(context, 'category_updated', 'dictionary_category', id, existing, updated)
      return updated
    })
  }

  async deleteCategory(context: AuthContext, id: string, expectedRevision: number) {
    await this.authorize(context, 'manage')
    return this.work.run(async (tx) => {
      const existing = await this.requiredCategory(tx.store, context.tenantId, id, true)
      this.assertRevision(existing.revision, expectedRevision)
      if (await tx.store.categoryHasTypes(context.tenantId, id))
        fail('DICTIONARY_CATEGORY_NOT_EMPTY', '分类下存在字典类型，请先移动类型')
      if (!(await tx.store.deleteCategory(context.tenantId, id, expectedRevision)))
        this.revisionConflict()
      await tx.record(context, 'category_deleted', 'dictionary_category', id, existing, null)
      return { id }
    })
  }

  async createType(
    context: AuthContext,
    input: CreateDictionaryType,
  ): Promise<DictionaryTypeDetail> {
    await this.authorize(context, 'manage')
    return this.work.run(async (tx) => {
      await this.requiredCategory(tx.store, context.tenantId, input.categoryId, true)
      if ((await tx.store.typeCount(context.tenantId)) >= TYPE_LIMIT)
        fail('DICTIONARY_TYPE_LIMIT_EXCEEDED', '字典类型数量已达上限')
      if (await tx.store.typeCodeTaken(context.tenantId, input.code))
        fail('DICTIONARY_TYPE_CODE_CONFLICT', '字典类型编码已存在')
      const now = new Date()
      const type = {
        id: newEntityId(),
        categoryId: input.categoryId,
        code: input.code,
        name: input.name,
        status: input.status ?? ('ENABLED' as const),
        revision: 1,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }
      await tx.store.insertType(context, type)
      await tx.record(context, 'type_created', 'dictionary_type', type.id, null, type)
      return { type, items: [] }
    })
  }

  async updateType(
    context: AuthContext,
    id: string,
    input: UpdateDictionaryType,
  ): Promise<DictionaryTypeDetail> {
    await this.authorize(context, 'manage')
    return this.work.run(async (tx) => {
      const existing = await this.requiredType(tx.store, context.tenantId, id, true)
      this.assertRevision(existing.revision, input.expectedRevision)
      if (input.categoryId !== undefined && input.categoryId !== existing.categoryId)
        await this.requiredCategory(tx.store, context.tenantId, input.categoryId, true)
      const categoryId = input.categoryId ?? existing.categoryId
      const name = input.name ?? existing.name
      const status = input.status ?? existing.status
      if (
        categoryId === existing.categoryId &&
        name === existing.name &&
        status === existing.status
      )
        return { type: existing, items: await tx.store.listItems(context.tenantId, id) }
      const changed = await tx.store.updateType(
        context,
        id,
        {
          ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.status === undefined ? {} : { status: input.status }),
          updatedAt: new Date(),
        },
        input.expectedRevision,
      )
      if (!changed) this.revisionConflict()
      const detail = await this.requiredDetail(tx.store, context.tenantId, id)
      await tx.record(context, 'type_updated', 'dictionary_type', id, existing, detail.type)
      return detail
    })
  }

  async createItem(
    context: AuthContext,
    typeId: string,
    input: CreateDictionaryItem,
  ): Promise<DictionaryTypeDetail> {
    await this.authorize(context, 'manage')
    return this.work.run(async (tx) => {
      const type = await this.requiredType(tx.store, context.tenantId, typeId, true)
      this.assertRevision(type.revision, input.expectedRevision)
      if ((await tx.store.itemCount(context.tenantId, typeId)) >= ITEM_LIMIT)
        fail('DICTIONARY_ITEM_LIMIT_EXCEEDED', '字典条目数量已达上限')
      if (await tx.store.itemCodeTaken(context.tenantId, typeId, input.code))
        fail('DICTIONARY_ITEM_CODE_CONFLICT', '字典条目编码已存在')
      const now = new Date()
      const item = {
        id: newEntityId(),
        typeId,
        code: input.code,
        label: input.label,
        status: input.status ?? ('ENABLED' as const),
        sortOrder: input.sortOrder ?? 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }
      await tx.store.insertItem(context, item)
      await this.touchType(tx.store, context, typeId, input.expectedRevision, now)
      const detail = await this.requiredDetail(tx.store, context.tenantId, typeId)
      await tx.record(context, 'item_created', 'dictionary_item', item.id, null, item)
      return detail
    })
  }

  async updateItem(
    context: AuthContext,
    typeId: string,
    itemId: string,
    input: UpdateDictionaryItem,
  ): Promise<DictionaryTypeDetail> {
    await this.authorize(context, 'manage')
    return this.work.run(async (tx) => {
      const type = await this.requiredType(tx.store, context.tenantId, typeId, true)
      this.assertRevision(type.revision, input.expectedRevision)
      const existing = await this.requiredItem(tx.store, context.tenantId, typeId, itemId)
      const label = input.label ?? existing.label
      const status = input.status ?? existing.status
      const sortOrder = input.sortOrder ?? existing.sortOrder
      if (
        label === existing.label &&
        status === existing.status &&
        sortOrder === existing.sortOrder
      )
        return this.requiredDetail(tx.store, context.tenantId, typeId)
      const now = new Date()
      await tx.store.updateItem(context, typeId, itemId, {
        ...(input.label === undefined ? {} : { label: input.label }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
        updatedAt: now,
      })
      await this.touchType(tx.store, context, typeId, input.expectedRevision, now)
      const detail = await this.requiredDetail(tx.store, context.tenantId, typeId)
      const updated = detail.items.find((item) => item.id === itemId)
      await tx.record(context, 'item_updated', 'dictionary_item', itemId, existing, updated)
      return detail
    })
  }

  private async touchType(
    store: DictionaryStore,
    context: AuthContext,
    id: string,
    expectedRevision: number,
    updatedAt: Date,
  ) {
    if (!(await store.touchType(context, id, expectedRevision, updatedAt))) this.revisionConflict()
  }

  private async requiredCategory(
    store: DictionaryStore,
    tenantId: TenantId,
    id: string,
    lock = false,
  ) {
    const category = await store.category(tenantId, id, lock)
    if (category === null) fail('DICTIONARY_CATEGORY_NOT_FOUND', '字典分类不存在', 404)
    return category
  }

  private async requiredType(store: DictionaryStore, tenantId: TenantId, id: string, lock = false) {
    const type = await store.type(tenantId, id, lock)
    if (type === null) fail('DICTIONARY_TYPE_NOT_FOUND', '字典类型不存在', 404)
    return type
  }

  private async requiredItem(
    store: DictionaryStore,
    tenantId: TenantId,
    typeId: string,
    id: string,
  ) {
    const item = await store.item(tenantId, typeId, id)
    if (item === null) fail('DICTIONARY_ITEM_NOT_FOUND', '字典条目不存在', 404)
    return item
  }

  private async requiredDetail(store: DictionaryStore, tenantId: TenantId, id: string) {
    const type = await this.requiredType(store, tenantId, id)
    return { type, items: await store.listItems(tenantId, id) }
  }

  private assertRevision(actual: number, expected: number) {
    if (actual !== expected) this.revisionConflict()
  }

  private revisionConflict(): never {
    return fail('DICTIONARY_REVISION_CONFLICT', '字典已被其他管理员修改，请重新加载')
  }
}
