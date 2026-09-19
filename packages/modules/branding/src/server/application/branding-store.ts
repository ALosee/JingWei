import type { ApplicationContext, TenantId } from '@jingwei/kernel'

import type {
  BrandAdmin,
  BrandAsset,
  BrandAssetPurpose,
  BrandConfiguration,
  BrandVersion,
} from '../../shared/index.js'

export interface BrandRoot {
  readonly id: string
  readonly publishedVersionId: string | null
}

export type StoredBrandAsset = BrandAsset & { readonly bytes: Uint8Array }

export interface BrandingStore {
  root(tenantId: TenantId, lock?: boolean): Promise<BrandRoot | null>
  ensureRoot(context: ApplicationContext): Promise<BrandRoot>
  list(tenantId: TenantId): Promise<BrandAdmin>
  version(tenantId: TenantId, id: string): Promise<BrandVersion | null>
  published(tenantId: TenantId): Promise<BrandVersion | null>
  nextRevision(tenantId: TenantId): Promise<number>
  insertVersion(context: ApplicationContext, rootId: string, version: BrandVersion): Promise<void>
  saveDraft(
    context: ApplicationContext,
    id: string,
    configuration: BrandConfiguration,
    expectedEditRevision: number,
  ): Promise<boolean>
  markPublished(
    context: ApplicationContext,
    id: string,
    expectedEditRevision: number,
  ): Promise<boolean>
  pointPublished(
    context: ApplicationContext,
    rootId: string,
    versionId: string | null,
  ): Promise<void>
  deleteDraft(context: ApplicationContext, id: string): Promise<boolean>
  insertAsset(
    context: ApplicationContext,
    purpose: BrandAssetPurpose,
    bytes: Uint8Array,
    metadata: Omit<BrandAsset, 'id' | 'purpose' | 'url'>,
  ): Promise<BrandAsset>
  assetsExist(
    tenantId: TenantId,
    references: readonly { id: string; purpose: BrandAssetPurpose }[],
  ): Promise<boolean>
  publicAsset(id: string): Promise<StoredBrandAsset | null>
}

export interface BrandingTransaction {
  readonly store: BrandingStore
  record(
    context: ApplicationContext,
    action: string,
    entityType: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): Promise<void>
}

export interface BrandingUnitOfWork {
  run<T>(work: (transaction: BrandingTransaction) => Promise<T>): Promise<T>
}
