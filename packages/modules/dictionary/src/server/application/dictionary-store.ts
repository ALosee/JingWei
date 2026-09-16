import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type {
  DictionaryCategory,
  DictionaryItem,
  DictionaryStatus,
  DictionaryType,
} from '../../shared/index.js'

export interface DictionaryStore {
  listCategories(tenantId: TenantId): Promise<DictionaryCategory[]>
  category(tenantId: TenantId, id: string, lock?: boolean): Promise<DictionaryCategory | null>
  categoryCodeTaken(tenantId: TenantId, code: string): Promise<boolean>
  categoryCount(tenantId: TenantId): Promise<number>
  categoryHasTypes(tenantId: TenantId, id: string): Promise<boolean>
  insertCategory(context: ApplicationContext, category: DictionaryCategory): Promise<void>
  updateCategory(
    context: ApplicationContext,
    id: string,
    patch: { name?: string; sortOrder?: number; updatedAt: Date },
    expectedRevision: number,
  ): Promise<boolean>
  deleteCategory(tenantId: TenantId, id: string, expectedRevision: number): Promise<boolean>

  listTypes(tenantId: TenantId): Promise<DictionaryType[]>
  type(tenantId: TenantId, id: string, lock?: boolean): Promise<DictionaryType | null>
  typeByCode(tenantId: TenantId, code: string): Promise<DictionaryType | null>
  typeCodeTaken(tenantId: TenantId, code: string): Promise<boolean>
  typeCount(tenantId: TenantId): Promise<number>
  insertType(context: ApplicationContext, type: DictionaryType): Promise<void>
  updateType(
    context: ApplicationContext,
    id: string,
    patch: {
      categoryId?: string
      name?: string
      status?: DictionaryStatus
      updatedAt: Date
    },
    expectedRevision: number,
  ): Promise<boolean>
  touchType(
    context: ApplicationContext,
    id: string,
    expectedRevision: number,
    updatedAt: Date,
  ): Promise<boolean>

  listItems(tenantId: TenantId, typeId: string): Promise<DictionaryItem[]>
  item(tenantId: TenantId, typeId: string, id: string): Promise<DictionaryItem | null>
  itemCodeTaken(tenantId: TenantId, typeId: string, code: string): Promise<boolean>
  itemCount(tenantId: TenantId, typeId: string): Promise<number>
  insertItem(context: ApplicationContext, item: DictionaryItem): Promise<void>
  updateItem(
    context: ApplicationContext,
    typeId: string,
    id: string,
    patch: {
      label?: string
      status?: DictionaryStatus
      sortOrder?: number
      updatedAt: Date
    },
  ): Promise<void>
}

export interface DictionaryTransaction {
  store: DictionaryStore
  record(
    context: ApplicationContext,
    action: string,
    entityType: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): Promise<void>
}

export interface DictionaryUnitOfWork {
  run<T>(work: (transaction: DictionaryTransaction) => Promise<T>): Promise<T>
}
