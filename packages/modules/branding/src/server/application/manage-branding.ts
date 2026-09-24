import { ApplicationError, newEntityId, type AuthContext } from '@jingwei/kernel'
import type { IamAccess } from '@jingwei/module-iam/server/public'

import { validateBrandTheme } from '../../shared/brand-theme-validation.js'
import {
  defaultBrandConfiguration,
  type BrandAdmin,
  type BrandAsset,
  type BrandAssetPurpose,
  type BrandConfiguration,
  type BrandDraftSource,
  type BrandVersion,
  type PublishBrand,
  type SaveBrandDraft,
} from '../../shared/index.js'
import { validateBrandImage } from '../domain/brand-image.js'
import { brandingPermissionRequirements } from './authorization-requirements.js'
import type { BrandingStore, BrandingUnitOfWork } from './branding-store.js'

function fail(code: string, message: string, status: number): never {
  throw new ApplicationError({ code, message, status })
}

function configurationOf(version: BrandVersion): BrandConfiguration {
  return {
    systemName: version.systemName,
    shortName: version.shortName,
    loginTitle: version.loginTitle,
    loginTagline: version.loginTagline,
    titleMode: version.titleMode,
    horizontalBrandMode: version.horizontalBrandMode,
    logoColorMode: version.logoColorMode,
    logoAssetId: version.logoAssetId,
    markAssetId: version.markAssetId,
    faviconAssetId: version.faviconAssetId,
    visualTheme: version.visualTheme,
    workspaceDefaults: version.workspaceDefaults,
  }
}

function references(configuration: BrandConfiguration) {
  return [
    ...(configuration.logoAssetId === null
      ? []
      : [{ id: configuration.logoAssetId, purpose: 'LOGO' as const }]),
    ...(configuration.markAssetId === null
      ? []
      : [{ id: configuration.markAssetId, purpose: 'MARK' as const }]),
    ...(configuration.faviconAssetId === null
      ? []
      : [{ id: configuration.faviconAssetId, purpose: 'FAVICON' as const }]),
  ]
}

/** Owns tenant authorization, optimistic concurrency and brand publication transactions. */
export class ManageBranding {
  constructor(
    private readonly store: BrandingStore,
    private readonly work: BrandingUnitOfWork,
    private readonly access: IamAccess,
  ) {}

  private authorize(context: AuthContext, action: 'view' | 'manage' | 'publish') {
    return this.access.requireUnscopedPermission(context, brandingPermissionRequirements[action])
  }

  async list(context: AuthContext): Promise<BrandAdmin> {
    await this.authorize(context, 'view')
    return this.store.list(context.tenantId)
  }

  async version(context: AuthContext, id: string): Promise<BrandVersion> {
    await this.authorize(context, 'view')
    return this.requiredVersion(this.store, context, id)
  }

  async createDraft(context: AuthContext, source: BrandDraftSource): Promise<BrandVersion> {
    await this.authorize(context, 'manage')
    return this.work.run(async (transaction) => {
      const root = await transaction.store.ensureRoot(context)
      const sourceVersion =
        source.kind === 'PLATFORM_DEFAULT'
          ? null
          : await this.requiredVersion(transaction.store, context, source.versionId)
      const configuration =
        sourceVersion === null ? defaultBrandConfiguration : configurationOf(sourceVersion)
      const version: BrandVersion = {
        id: newEntityId(),
        revision: await transaction.store.nextRevision(context.tenantId),
        editRevision: 0,
        status: 'DRAFT',
        publishedAt: null,
        ...configuration,
        logoAsset: sourceVersion?.logoAsset ?? null,
        markAsset: sourceVersion?.markAsset ?? null,
        faviconAsset: sourceVersion?.faviconAsset ?? null,
      }
      await transaction.store.insertVersion(context, root.id, version)
      await transaction.record(context, 'draft_created', 'brand_version', version.id, null, {
        revision: version.revision,
        source: source.kind,
        sourceVersionId: sourceVersion?.id ?? null,
      })
      return version
    })
  }

  async save(context: AuthContext, id: string, input: SaveBrandDraft): Promise<BrandVersion> {
    await this.authorize(context, 'manage')
    return this.work.run(async (transaction) => {
      const existing = await this.requiredVersion(transaction.store, context, id)
      if (existing.status !== 'DRAFT')
        fail('BRANDING_VERSION_IMMUTABLE', '已发布品牌版本不可修改', 409)
      if (existing.editRevision !== input.expectedEditRevision)
        fail('BRANDING_EDIT_CONFLICT', '品牌草稿已被其他操作修改，请重新加载', 409)
      const configuration: BrandConfiguration = {
        systemName: input.systemName,
        shortName: input.shortName,
        loginTitle: input.loginTitle,
        loginTagline: input.loginTagline,
        titleMode: input.titleMode,
        horizontalBrandMode: input.horizontalBrandMode,
        logoColorMode: input.logoColorMode,
        logoAssetId: input.logoAssetId,
        markAssetId: input.markAssetId,
        faviconAssetId: input.faviconAssetId,
        visualTheme: input.visualTheme,
        workspaceDefaults: input.workspaceDefaults,
      }
      if (!(await transaction.store.assetsExist(context.tenantId, references(configuration))))
        fail('BRANDING_ASSET_NOT_FOUND', '品牌素材不存在或用途不匹配', 422)
      if (
        !(await transaction.store.saveDraft(context, id, configuration, input.expectedEditRevision))
      )
        fail('BRANDING_EDIT_CONFLICT', '品牌草稿已被其他操作修改，请重新加载', 409)
      const updated = await this.requiredVersion(transaction.store, context, id)
      await transaction.record(
        context,
        'draft_saved',
        'brand_version',
        id,
        configurationOf(existing),
        configurationOf(updated),
      )
      return updated
    })
  }

  async publish(
    context: AuthContext,
    id: string,
    input: PublishBrand,
    rollback = false,
  ): Promise<BrandVersion> {
    await this.authorize(context, 'publish')
    return this.work.run(async (transaction) => {
      const root = await transaction.store.ensureRoot(context)
      if (root.publishedVersionId !== input.expectedPublishedVersionId)
        fail('BRANDING_PUBLISH_CONFLICT', '已发布品牌指针已变更，请重新加载', 409)
      const version = await this.requiredVersion(transaction.store, context, id)
      if (version.editRevision !== input.expectedEditRevision)
        fail('BRANDING_EDIT_CONFLICT', '品牌版本已被修改，请重新加载', 409)
      if (rollback) {
        if (version.status !== 'PUBLISHED')
          fail('BRANDING_ROLLBACK_TARGET_INVALID', '只能回滚到历史已发布版本', 409)
      } else {
        if (version.status !== 'DRAFT')
          fail('BRANDING_VERSION_IMMUTABLE', '当前版本不是可发布草稿', 409)
        const themeIssues = validateBrandTheme(version.visualTheme)
        if (themeIssues.length > 0)
          fail('BRANDING_THEME_INVALID', `主题无法发布：${themeIssues.join('；')}`, 422)
        if (!(await transaction.store.markPublished(context, id, input.expectedEditRevision)))
          fail('BRANDING_EDIT_CONFLICT', '品牌版本已被修改，请重新加载', 409)
      }
      await transaction.store.pointPublished(context, root.id, id)
      const published = await this.requiredVersion(transaction.store, context, id)
      await transaction.record(
        context,
        rollback ? 'rolled_back' : 'published',
        'brand_version',
        id,
        { publishedVersionId: root.publishedVersionId },
        { publishedVersionId: id, revision: published.revision },
      )
      return published
    })
  }

  async deleteDraft(context: AuthContext, id: string): Promise<{ id: string }> {
    await this.authorize(context, 'manage')
    return this.work.run(async (transaction) => {
      const version = await this.requiredVersion(transaction.store, context, id)
      if (version.status !== 'DRAFT')
        fail('BRANDING_VERSION_IMMUTABLE', '已发布品牌版本不可删除', 409)
      if (!(await transaction.store.deleteDraft(context, id)))
        fail('BRANDING_EDIT_CONFLICT', '品牌草稿状态已变更，请重新加载', 409)
      await transaction.record(
        context,
        'draft_deleted',
        'brand_version',
        id,
        {
          revision: version.revision,
        },
        null,
      )
      return { id }
    })
  }

  async restoreDefault(
    context: AuthContext,
    expectedPublishedVersionId: string,
  ): Promise<{ publishedVersionId: null }> {
    await this.authorize(context, 'publish')
    return this.work.run(async (transaction) => {
      const root = await transaction.store.ensureRoot(context)
      if (root.publishedVersionId !== expectedPublishedVersionId)
        fail('BRANDING_PUBLISH_CONFLICT', '已发布品牌指针已变更，请重新加载', 409)
      await transaction.store.pointPublished(context, root.id, null)
      await transaction.record(
        context,
        'default_restored',
        'brand_profile',
        root.id,
        { publishedVersionId: root.publishedVersionId },
        { publishedVersionId: null },
      )
      return { publishedVersionId: null }
    })
  }

  async uploadAsset(
    context: AuthContext,
    purpose: BrandAssetPurpose,
    bytes: Uint8Array,
  ): Promise<BrandAsset> {
    await this.authorize(context, 'manage')
    const metadata = validateBrandImage(purpose, bytes)
    return this.work.run(async (transaction) => {
      const asset = await transaction.store.insertAsset(context, purpose, bytes, metadata)
      await transaction.record(context, 'asset_uploaded', 'brand_asset', asset.id, null, asset)
      return asset
    })
  }

  private async requiredVersion(
    store: BrandingStore,
    context: AuthContext,
    id: string,
  ): Promise<BrandVersion> {
    const version = await store.version(context.tenantId, id)
    if (version === null) fail('BRANDING_VERSION_NOT_FOUND', '品牌版本不存在', 404)
    return version
  }
}
