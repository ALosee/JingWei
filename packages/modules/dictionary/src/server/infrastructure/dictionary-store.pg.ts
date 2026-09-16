import { sql, type Kysely } from 'kysely'

import { PostgresAuditWriter } from '@jingwei/audit'
import { ApplicationError, type ApplicationContext, type TenantId } from '@jingwei/kernel'
import { PostgresOutboxAppender } from '@jingwei/outbox'

import type {
  DictionaryCategory,
  DictionaryItem,
  DictionaryStatus,
  DictionaryType,
} from '../../shared/index.js'
import type {
  DictionaryStore,
  DictionaryTransaction,
  DictionaryUnitOfWork,
} from '../application/dictionary-store.js'

interface DictionaryCategoryRow {
  id: string
  tenant_id: string
  code: string
  name: string
  sort_order: number
  revision: number
  created_at: Date
  created_by: string | null
  updated_at: Date
  updated_by: string | null
}

interface DictionaryTypeRow {
  id: string
  tenant_id: string
  category_id: string
  code: string
  name: string
  status: DictionaryStatus
  revision: number
  created_at: Date
  created_by: string | null
  updated_at: Date
  updated_by: string | null
}

interface DictionaryItemRow {
  id: string
  tenant_id: string
  dictionary_type_id: string
  code: string
  label: string
  status: DictionaryStatus
  sort_order: number
  created_at: Date
  created_by: string | null
  updated_at: Date
  updated_by: string | null
}

export interface DictionaryDatabase {
  'dictionary.dictionary_category': DictionaryCategoryRow
  'dictionary.dictionary_type': DictionaryTypeRow
  'dictionary.dictionary_item': DictionaryItemRow
}

function toCategory(row: DictionaryCategoryRow): DictionaryCategory {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sortOrder: row.sort_order,
    revision: row.revision,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function toType(row: DictionaryTypeRow): DictionaryType {
  return {
    id: row.id,
    categoryId: row.category_id,
    code: row.code,
    name: row.name,
    status: row.status,
    revision: row.revision,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function toItem(row: DictionaryItemRow): DictionaryItem {
  return {
    id: row.id,
    typeId: row.dictionary_type_id,
    code: row.code,
    label: row.label,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function changed(result: { numUpdatedRows: bigint }): boolean {
  return result.numUpdatedRows === 1n
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  )
}

/** Map PostgreSQL unique violations to stable application conflicts before they become 500s. */
async function insertOrConflict(
  work: Promise<unknown>,
  code: string,
  message: string,
): Promise<void> {
  try {
    await work
  } catch (cause) {
    if (isUniqueViolation(cause)) throw new ApplicationError({ code, message, status: 409 })
    throw cause
  }
}

export class PostgresDictionaryStore implements DictionaryStore {
  constructor(private readonly db: Kysely<DictionaryDatabase>) {}

  async listCategories(tenantId: TenantId) {
    const rows = await this.db
      .selectFrom('dictionary.dictionary_category')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .orderBy('sort_order')
      .orderBy('code')
      .execute()
    return rows.map(toCategory)
  }

  async category(tenantId: TenantId, id: string, lock = false) {
    const query = this.db
      .selectFrom('dictionary.dictionary_category')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('id', '=', id)
    const row = await (lock ? query.forUpdate() : query).executeTakeFirst()
    return row === undefined ? null : toCategory(row)
  }

  async categoryCodeTaken(tenantId: TenantId, code: string) {
    return (
      (await this.db
        .selectFrom('dictionary.dictionary_category')
        .select('id')
        .where('tenant_id', '=', tenantId)
        .where('code', '=', code)
        .executeTakeFirst()) !== undefined
    )
  }

  async categoryCount(tenantId: TenantId) {
    const row = await this.db
      .selectFrom('dictionary.dictionary_category')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('tenant_id', '=', tenantId)
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  async categoryHasTypes(tenantId: TenantId, id: string) {
    return (
      (await this.db
        .selectFrom('dictionary.dictionary_type')
        .select('id')
        .where('tenant_id', '=', tenantId)
        .where('category_id', '=', id)
        .executeTakeFirst()) !== undefined
    )
  }

  async insertCategory(context: ApplicationContext, category: DictionaryCategory) {
    await insertOrConflict(
      this.db
        .insertInto('dictionary.dictionary_category')
        .values({
          id: category.id,
          tenant_id: context.tenantId,
          code: category.code,
          name: category.name,
          sort_order: category.sortOrder,
          revision: category.revision,
          created_at: new Date(category.createdAt),
          created_by: context.userId,
          updated_at: new Date(category.updatedAt),
          updated_by: context.userId,
        })
        .executeTakeFirstOrThrow(),
      'DICTIONARY_CATEGORY_CODE_CONFLICT',
      '字典分类编码已存在',
    )
  }

  async updateCategory(
    context: ApplicationContext,
    id: string,
    patch: { name?: string; sortOrder?: number; updatedAt: Date },
    expectedRevision: number,
  ) {
    const result = await this.db
      .updateTable('dictionary.dictionary_category')
      .set({
        ...(patch.name === undefined ? {} : { name: patch.name }),
        ...(patch.sortOrder === undefined ? {} : { sort_order: patch.sortOrder }),
        revision: sql<number>`revision + 1`,
        updated_at: patch.updatedAt,
        updated_by: context.userId,
      })
      .where('tenant_id', '=', context.tenantId)
      .where('id', '=', id)
      .where('revision', '=', expectedRevision)
      .executeTakeFirst()
    return changed(result)
  }

  async deleteCategory(tenantId: TenantId, id: string, expectedRevision: number) {
    const result = await this.db
      .deleteFrom('dictionary.dictionary_category')
      .where('tenant_id', '=', tenantId)
      .where('id', '=', id)
      .where('revision', '=', expectedRevision)
      .executeTakeFirst()
    return result.numDeletedRows === 1n
  }

  async listTypes(tenantId: TenantId) {
    const rows = await this.db
      .selectFrom('dictionary.dictionary_type')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .orderBy('name')
      .orderBy('code')
      .execute()
    return rows.map(toType)
  }

  async type(tenantId: TenantId, id: string, lock = false) {
    const query = this.db
      .selectFrom('dictionary.dictionary_type')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('id', '=', id)
    const row = await (lock ? query.forUpdate() : query).executeTakeFirst()
    return row === undefined ? null : toType(row)
  }

  async typeByCode(tenantId: TenantId, code: string) {
    const row = await this.db
      .selectFrom('dictionary.dictionary_type')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('code', '=', code)
      .executeTakeFirst()
    return row === undefined ? null : toType(row)
  }

  async typeCodeTaken(tenantId: TenantId, code: string) {
    return (await this.typeByCode(tenantId, code)) !== null
  }

  async typeCount(tenantId: TenantId) {
    const row = await this.db
      .selectFrom('dictionary.dictionary_type')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('tenant_id', '=', tenantId)
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  async insertType(context: ApplicationContext, type: DictionaryType) {
    await insertOrConflict(
      this.db
        .insertInto('dictionary.dictionary_type')
        .values({
          id: type.id,
          tenant_id: context.tenantId,
          category_id: type.categoryId,
          code: type.code,
          name: type.name,
          status: type.status,
          revision: type.revision,
          created_at: new Date(type.createdAt),
          created_by: context.userId,
          updated_at: new Date(type.updatedAt),
          updated_by: context.userId,
        })
        .executeTakeFirstOrThrow(),
      'DICTIONARY_TYPE_CODE_CONFLICT',
      '字典类型编码已存在',
    )
  }

  async updateType(
    context: ApplicationContext,
    id: string,
    patch: {
      categoryId?: string
      name?: string
      status?: DictionaryStatus
      updatedAt: Date
    },
    expectedRevision: number,
  ) {
    const result = await this.db
      .updateTable('dictionary.dictionary_type')
      .set({
        ...(patch.categoryId === undefined ? {} : { category_id: patch.categoryId }),
        ...(patch.name === undefined ? {} : { name: patch.name }),
        ...(patch.status === undefined ? {} : { status: patch.status }),
        revision: sql<number>`revision + 1`,
        updated_at: patch.updatedAt,
        updated_by: context.userId,
      })
      .where('tenant_id', '=', context.tenantId)
      .where('id', '=', id)
      .where('revision', '=', expectedRevision)
      .executeTakeFirst()
    return changed(result)
  }

  async touchType(
    context: ApplicationContext,
    id: string,
    expectedRevision: number,
    updatedAt: Date,
  ) {
    const result = await this.db
      .updateTable('dictionary.dictionary_type')
      .set({
        revision: sql<number>`revision + 1`,
        updated_at: updatedAt,
        updated_by: context.userId,
      })
      .where('tenant_id', '=', context.tenantId)
      .where('id', '=', id)
      .where('revision', '=', expectedRevision)
      .executeTakeFirst()
    return changed(result)
  }

  async listItems(tenantId: TenantId, typeId: string) {
    const rows = await this.db
      .selectFrom('dictionary.dictionary_item')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('dictionary_type_id', '=', typeId)
      .orderBy('sort_order')
      .orderBy('code')
      .execute()
    return rows.map(toItem)
  }

  async item(tenantId: TenantId, typeId: string, id: string) {
    const row = await this.db
      .selectFrom('dictionary.dictionary_item')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('dictionary_type_id', '=', typeId)
      .where('id', '=', id)
      .executeTakeFirst()
    return row === undefined ? null : toItem(row)
  }

  async itemCodeTaken(tenantId: TenantId, typeId: string, code: string) {
    return (
      (await this.db
        .selectFrom('dictionary.dictionary_item')
        .select('id')
        .where('tenant_id', '=', tenantId)
        .where('dictionary_type_id', '=', typeId)
        .where('code', '=', code)
        .executeTakeFirst()) !== undefined
    )
  }

  async itemCount(tenantId: TenantId, typeId: string) {
    const row = await this.db
      .selectFrom('dictionary.dictionary_item')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('tenant_id', '=', tenantId)
      .where('dictionary_type_id', '=', typeId)
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  async insertItem(context: ApplicationContext, item: DictionaryItem) {
    await insertOrConflict(
      this.db
        .insertInto('dictionary.dictionary_item')
        .values({
          id: item.id,
          tenant_id: context.tenantId,
          dictionary_type_id: item.typeId,
          code: item.code,
          label: item.label,
          status: item.status,
          sort_order: item.sortOrder,
          created_at: new Date(item.createdAt),
          created_by: context.userId,
          updated_at: new Date(item.updatedAt),
          updated_by: context.userId,
        })
        .executeTakeFirstOrThrow(),
      'DICTIONARY_ITEM_CODE_CONFLICT',
      '字典条目编码已存在',
    )
  }

  async updateItem(
    context: ApplicationContext,
    typeId: string,
    id: string,
    patch: {
      label?: string
      status?: DictionaryStatus
      sortOrder?: number
      updatedAt: Date
    },
  ) {
    await this.db
      .updateTable('dictionary.dictionary_item')
      .set({
        ...(patch.label === undefined ? {} : { label: patch.label }),
        ...(patch.status === undefined ? {} : { status: patch.status }),
        ...(patch.sortOrder === undefined ? {} : { sort_order: patch.sortOrder }),
        updated_at: patch.updatedAt,
        updated_by: context.userId,
      })
      .where('tenant_id', '=', context.tenantId)
      .where('dictionary_type_id', '=', typeId)
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
  }
}

export class PostgresDictionaryUnitOfWork implements DictionaryUnitOfWork {
  constructor(private readonly db: Kysely<DictionaryDatabase>) {}

  run<T>(work: (transaction: DictionaryTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(async (transaction) =>
      work({
        store: new PostgresDictionaryStore(transaction),
        record: async (context, action, entityType, entityId, before, after) => {
          await new PostgresAuditWriter(transaction).append({
            context,
            module: 'dictionary',
            action,
            entityType,
            entityId,
            result: 'SUCCESS',
            before,
            after,
          })
        },
        publishDefinitionChanged: async (context, typeId, dictionaryCode, revision) => {
          await new PostgresOutboxAppender().append(transaction, {
            tenantId: context.tenantId,
            type: 'dictionary.definition.changed',
            version: 1,
            aggregateType: 'dictionary_type',
            aggregateId: typeId,
            occurredAt: new Date(),
            payload: { dictionaryCode, revision },
          })
        },
      }),
    )
  }
}
