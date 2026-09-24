import { describe, expect, it } from 'vitest'

import {
  newEntityId,
  newRequestId,
  newSessionId,
  newTenantId,
  newUserId,
  type ApplicationContext,
  type AuthContext,
  type TenantId,
} from '@jingwei/kernel'
import type { IamAccess } from '@jingwei/module-iam/server/public'

import {
  brandAssetSchema,
  brandAssetUrl,
  brandFaviconAssetSchema,
  brandLogoAssetSchema,
  brandMarkAssetSchema,
  defaultBrandConfiguration,
  type BrandAdmin,
  type BrandAsset,
  type BrandAssetPurpose,
  type BrandConfiguration,
  type BrandVersion,
} from '../../shared/index.js'
import type {
  BrandingStore,
  BrandingTransaction,
  BrandingUnitOfWork,
  StoredBrandAsset,
} from './branding-store.js'
import { ManageBranding } from './manage-branding.js'
import { ResolveBranding } from './resolve-branding.js'

interface MemoryVersion {
  tenantId: TenantId
  profileId: string
  value: BrandVersion
}

interface MemoryAsset {
  tenantId: TenantId
  value: StoredBrandAsset
}

function storedAssetMetadata(asset: StoredBrandAsset): BrandAsset {
  return brandAssetSchema.parse({
    id: asset.id,
    purpose: asset.purpose,
    contentType: asset.contentType,
    validationProfile: asset.validationProfile,
    width: asset.width,
    height: asset.height,
    byteSize: asset.byteSize,
    url: asset.url,
  })
}

class MemoryBrandingStore implements BrandingStore {
  readonly roots = new Map<TenantId, { id: string; publishedVersionId: string | null }>()
  readonly versions = new Map<string, MemoryVersion>()
  readonly assets = new Map<string, MemoryAsset>()
  rejectNextPublish = false

  root(tenantId: TenantId) {
    return Promise.resolve(this.roots.get(tenantId) ?? null)
  }

  ensureRoot(context: ApplicationContext) {
    const existing = this.roots.get(context.tenantId)
    if (existing !== undefined) return Promise.resolve(existing)
    const created = { id: newEntityId(), publishedVersionId: null }
    this.roots.set(context.tenantId, created)
    return Promise.resolve(created)
  }

  list(tenantId: TenantId): Promise<BrandAdmin> {
    const root = this.roots.get(tenantId)
    const versions = [...this.versions.values()]
      .filter((item) => item.tenantId === tenantId)
      .sort((left, right) => right.value.revision - left.value.revision)
      .map(({ value }) => ({
        id: value.id,
        revision: value.revision,
        editRevision: value.editRevision,
        status: value.status,
        publishedAt: value.publishedAt,
      }))
    return Promise.resolve({ publishedVersionId: root?.publishedVersionId ?? null, versions })
  }

  version(tenantId: TenantId, id: string) {
    const stored = this.versions.get(id)
    return Promise.resolve(stored?.tenantId === tenantId ? structuredClone(stored.value) : null)
  }

  async published(tenantId: TenantId) {
    const id = this.roots.get(tenantId)?.publishedVersionId
    return id === null || id === undefined ? null : this.version(tenantId, id)
  }

  nextRevision(tenantId: TenantId) {
    const revisions = [...this.versions.values()]
      .filter((item) => item.tenantId === tenantId)
      .map((item) => item.value.revision)
    return Promise.resolve(Math.max(0, ...revisions) + 1)
  }

  insertVersion(context: ApplicationContext, rootId: string, version: BrandVersion): Promise<void> {
    this.versions.set(version.id, {
      tenantId: context.tenantId,
      profileId: rootId,
      value: structuredClone(version),
    })
    return Promise.resolve()
  }

  saveDraft(
    context: ApplicationContext,
    id: string,
    configuration: BrandConfiguration,
    expectedEditRevision: number,
  ) {
    const stored = this.versions.get(id)
    if (stored?.tenantId !== context.tenantId) return Promise.resolve(false)
    if (stored.value.status !== 'DRAFT' || stored.value.editRevision !== expectedEditRevision)
      return Promise.resolve(false)
    stored.value = this.withAssets(context.tenantId, {
      ...stored.value,
      ...configuration,
      editRevision: expectedEditRevision + 1,
    })
    return Promise.resolve(true)
  }

  markPublished(context: ApplicationContext, id: string, expectedEditRevision: number) {
    const stored = this.versions.get(id)
    if (this.rejectNextPublish) {
      this.rejectNextPublish = false
      return Promise.resolve(false)
    }
    if (stored?.tenantId !== context.tenantId) return Promise.resolve(false)
    if (stored.value.status !== 'DRAFT' || stored.value.editRevision !== expectedEditRevision)
      return Promise.resolve(false)
    stored.value = {
      ...stored.value,
      status: 'PUBLISHED',
      publishedAt: new Date().toISOString(),
    }
    return Promise.resolve(true)
  }

  pointPublished(
    context: ApplicationContext,
    rootId: string,
    versionId: string | null,
  ): Promise<void> {
    const root = this.roots.get(context.tenantId)
    if (root?.id !== rootId) throw new Error('Missing brand root')
    root.publishedVersionId = versionId
    return Promise.resolve()
  }

  deleteDraft(context: ApplicationContext, id: string) {
    const stored = this.versions.get(id)
    if (stored?.tenantId !== context.tenantId) return Promise.resolve(false)
    if (stored.value.status !== 'DRAFT') return Promise.resolve(false)
    this.versions.delete(id)
    return Promise.resolve(true)
  }

  insertAsset(
    context: ApplicationContext,
    purpose: BrandAssetPurpose,
    bytes: Uint8Array,
    metadata: Omit<BrandAsset, 'id' | 'purpose' | 'url'>,
  ) {
    const id = newEntityId()
    const asset = brandAssetSchema.parse({
      id,
      purpose,
      url: brandAssetUrl(id),
      ...metadata,
    })
    const value: StoredBrandAsset = {
      ...asset,
      bytes,
    }
    this.assets.set(id, { tenantId: context.tenantId, value })
    return Promise.resolve<BrandAsset>(value)
  }

  assetsExist(
    tenantId: TenantId,
    references: readonly { id: string; purpose: BrandAssetPurpose }[],
  ) {
    return Promise.resolve(
      references.every(({ id, purpose }) => {
        const stored = this.assets.get(id)
        return stored?.tenantId === tenantId && stored.value.purpose === purpose
      }),
    )
  }

  publicAsset(id: string) {
    return Promise.resolve(this.assets.get(id)?.value ?? null)
  }

  private withAssets(tenantId: TenantId, version: BrandVersion): BrandVersion {
    const asset = (id: string | null) =>
      id === null || this.assets.get(id)?.tenantId !== tenantId
        ? null
        : (this.assets.get(id)?.value ?? null)
    const logoAsset = asset(version.logoAssetId)
    const markAsset = asset(version.markAssetId)
    const faviconAsset = asset(version.faviconAssetId)
    return {
      ...version,
      logoAsset:
        logoAsset === null ? null : brandLogoAssetSchema.parse(storedAssetMetadata(logoAsset)),
      markAsset:
        markAsset === null ? null : brandMarkAssetSchema.parse(storedAssetMetadata(markAsset)),
      faviconAsset:
        faviconAsset === null
          ? null
          : brandFaviconAssetSchema.parse(storedAssetMetadata(faviconAsset)),
    }
  }
}

function context(tenantId = newTenantId()): AuthContext {
  return {
    requestId: newRequestId(),
    tenantId,
    userId: newUserId(),
    sessionId: newSessionId(),
    roleIds: [],
  }
}

function fixture() {
  const store = new MemoryBrandingStore()
  const actions: string[] = []
  const work: BrandingUnitOfWork = {
    run<T>(operation: (transaction: BrandingTransaction) => Promise<T>) {
      return operation({
        store,
        record: (_context, action) => {
          actions.push(action)
          return Promise.resolve()
        },
      })
    },
  }
  const permissions: string[] = []
  const access: IamAccess = {
    activeRoleIds: () => Promise.resolve([]),
    roles: () => Promise.resolve([]),
    effectivePermissionCodes: () => Promise.resolve([]),
    requireUnscopedPermission: (_context, requirement) => {
      permissions.push(requirement.permission)
      return Promise.resolve()
    },
  }
  return {
    store,
    actions,
    permissions,
    manage: new ManageBranding(store, work, access),
    resolve: new ResolveBranding(store),
  }
}

function changedConfiguration(expectedEditRevision: number) {
  return {
    ...defaultBrandConfiguration,
    expectedEditRevision,
    systemName: '客户协同平台',
    shortName: '协同',
    loginTitle: '欢迎使用客户协同平台',
    visualTheme: {
      ...defaultBrandConfiguration.visualTheme,
      primaryPalette: 'rose' as const,
      radius: 'lg' as const,
    },
    workspaceDefaults: {
      ...defaultBrandConfiguration.workspaceDefaults,
      layoutMode: 'top' as const,
      showTabs: false,
    },
  }
}

describe('brand configuration lifecycle', () => {
  it('keeps drafts private until an audited publication switches the tenant pointer', async () => {
    const { manage, resolve, actions, permissions } = fixture()
    const auth = context()

    await expect(resolve.effective(auth.tenantId)).resolves.toMatchObject({ source: 'DEFAULT' })
    const draft = await manage.createDraft(auth, { kind: 'PLATFORM_DEFAULT' })
    const saved = await manage.save(auth, draft.id, changedConfiguration(0))
    await expect(resolve.effective(auth.tenantId)).resolves.toMatchObject({ source: 'DEFAULT' })

    const published = await manage.publish(auth, saved.id, {
      expectedEditRevision: saved.editRevision,
      expectedPublishedVersionId: null,
    })

    await expect(resolve.effective(auth.tenantId)).resolves.toMatchObject({
      source: 'PUBLISHED',
      publishedRevision: 1,
      systemName: '客户协同平台',
      visualTheme: { primaryPalette: 'rose', radius: 'lg' },
      workspaceDefaults: { layoutMode: 'top', showTabs: false },
    })
    expect(published.status).toBe('PUBLISHED')
    expect(actions).toEqual(['draft_created', 'draft_saved', 'published'])
    expect(permissions).toEqual(['branding.manage', 'branding.manage', 'branding.publish'])
  })

  it('atomically rejects a publication when the draft changes after validation', async () => {
    const { manage, store } = fixture()
    const auth = context()
    const draft = await manage.createDraft(auth, { kind: 'PLATFORM_DEFAULT' })
    store.rejectNextPublish = true

    await expect(
      manage.publish(auth, draft.id, {
        expectedEditRevision: draft.editRevision,
        expectedPublishedVersionId: null,
      }),
    ).rejects.toMatchObject({ code: 'BRANDING_EDIT_CONFLICT' })
    await expect(store.published(auth.tenantId)).resolves.toBeNull()
  })

  it('keeps an unsafe explicit theme pair in draft but refuses to publish it', async () => {
    const { manage, store } = fixture()
    const auth = context()
    const draft = await manage.createDraft(auth, { kind: 'PLATFORM_DEFAULT' })
    const saved = await manage.save(auth, draft.id, {
      ...changedConfiguration(0),
      visualTheme: {
        ...defaultBrandConfiguration.visualTheme,
        overrides: {
          light: {
            card: { kind: 'SIMPLE', value: 'black' },
            cardForeground: { kind: 'SIMPLE', value: 'black' },
          },
          dark: {},
        },
      },
    })

    await expect(
      manage.publish(auth, saved.id, {
        expectedEditRevision: saved.editRevision,
        expectedPublishedVersionId: null,
      }),
    ).rejects.toMatchObject({ code: 'BRANDING_THEME_INVALID', status: 422 })
    await expect(store.published(auth.tenantId)).resolves.toBeNull()
  })

  it('prevents cross-tenant version reads and supports an explicit history rollback', async () => {
    const { manage } = fixture()
    const firstTenant = context()
    const otherTenant = context()
    const firstDraft = await manage.createDraft(firstTenant, { kind: 'PLATFORM_DEFAULT' })

    await expect(manage.version(otherTenant, firstDraft.id)).rejects.toMatchObject({
      code: 'BRANDING_VERSION_NOT_FOUND',
    })

    const firstPublished = await manage.publish(firstTenant, firstDraft.id, {
      expectedEditRevision: 0,
      expectedPublishedVersionId: null,
    })
    const secondDraft = await manage.createDraft(firstTenant, {
      kind: 'VERSION',
      versionId: firstPublished.id,
    })
    const secondPublished = await manage.publish(firstTenant, secondDraft.id, {
      expectedEditRevision: 0,
      expectedPublishedVersionId: firstPublished.id,
    })
    const rolledBack = await manage.publish(
      firstTenant,
      firstPublished.id,
      {
        expectedEditRevision: firstPublished.editRevision,
        expectedPublishedVersionId: secondPublished.id,
      },
      true,
    )
    expect(rolledBack.id).toBe(firstPublished.id)
    await expect(manage.list(firstTenant)).resolves.toMatchObject({
      publishedVersionId: firstPublished.id,
    })
  })

  it('restores the built-in platform brand without deleting published history', async () => {
    const { manage, resolve, store, actions } = fixture()
    const auth = context()
    const draft = await manage.createDraft(auth, { kind: 'PLATFORM_DEFAULT' })
    const published = await manage.publish(auth, draft.id, {
      expectedEditRevision: draft.editRevision,
      expectedPublishedVersionId: null,
    })

    await expect(manage.restoreDefault(auth, published.id)).resolves.toEqual({
      publishedVersionId: null,
    })
    await expect(resolve.effective(auth.tenantId)).resolves.toMatchObject({ source: 'DEFAULT' })
    expect(store.versions.has(published.id)).toBe(true)
    expect(actions).toContain('default_restored')
  })

  it('creates a platform-default draft after a customized version has been published', async () => {
    const { manage } = fixture()
    const auth = context()
    const initial = await manage.createDraft(auth, { kind: 'PLATFORM_DEFAULT' })
    const customized = await manage.save(auth, initial.id, changedConfiguration(0))
    await manage.publish(auth, customized.id, {
      expectedEditRevision: customized.editRevision,
      expectedPublishedVersionId: null,
    })

    const reset = await manage.createDraft(auth, { kind: 'PLATFORM_DEFAULT' })

    expect(reset).toMatchObject(defaultBrandConfiguration)
    expect(reset.id).not.toBe(customized.id)
  })
})
