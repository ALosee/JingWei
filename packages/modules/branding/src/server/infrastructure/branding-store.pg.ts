import { createHash } from 'node:crypto'

import type { Kysely } from 'kysely'

import { PostgresAuditWriter } from '@jingwei/audit'
import { newEntityId, type ApplicationContext, type TenantId } from '@jingwei/kernel'

import {
  brandAssetSchema,
  brandAssetUrl,
  brandVersionSchema,
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
} from '../application/branding-store.js'

interface ProfileRow {
  id: string
  tenant_id: string
  published_version_id: string | null
  created_at: Date
  created_by: string
  updated_at: Date
  updated_by: string
}
interface VersionRow {
  id: string
  tenant_id: string
  profile_id: string
  version: number
  edit_revision: number
  status: 'DRAFT' | 'PUBLISHED'
  system_name: string
  short_name: string
  login_title: string
  login_tagline: string
  title_mode: BrandConfiguration['titleMode']
  horizontal_brand_mode: BrandConfiguration['horizontalBrandMode']
  logo_color_mode: BrandConfiguration['logoColorMode']
  logo_asset_id: string | null
  mark_asset_id: string | null
  favicon_asset_id: string | null
  theme_base_palette: BrandConfiguration['visualTheme']['basePalette']
  theme_primary_palette: BrandConfiguration['visualTheme']['primaryPalette']
  theme_custom_base_palette: unknown
  theme_custom_primary_palette: unknown
  theme_radius: BrandConfiguration['visualTheme']['radius']
  theme_sidebar_scheme: BrandConfiguration['visualTheme']['sidebarScheme']
  theme_feedback_scheme: BrandConfiguration['visualTheme']['feedbackScheme']
  theme_chart_scheme: BrandConfiguration['visualTheme']['chartScheme']
  theme_light_level: BrandConfiguration['visualTheme']['lightLevel']
  theme_dark_level: BrandConfiguration['visualTheme']['darkLevel']
  theme_border_opacity: number
  theme_overrides: unknown
  workspace_layout_mode: BrandConfiguration['workspaceDefaults']['layoutMode']
  workspace_brand_placement: BrandConfiguration['workspaceDefaults']['brandPlacement']
  workspace_header_height: number
  workspace_sider_width: number
  workspace_show_tabs: boolean
  created_at: Date
  created_by: string
  published_at: Date | null
  published_by: string | null
}
interface AssetRow {
  id: string
  tenant_id: string
  purpose: BrandAssetPurpose
  content_type: BrandAsset['contentType']
  validation_profile: BrandAsset['validationProfile']
  sha256: string
  width: number
  height: number
  byte_size: number
  payload: Uint8Array
  created_at: Date
  created_by: string
}
export interface BrandingDatabase {
  'branding.brand_profile': ProfileRow
  'branding.brand_version': VersionRow
  'branding.brand_asset': AssetRow
}

function assetMetadata(row: AssetRow): BrandAsset {
  return brandAssetSchema.parse({
    id: row.id,
    purpose: row.purpose,
    contentType: row.content_type,
    validationProfile: row.validation_profile,
    width: row.width,
    height: row.height,
    byteSize: row.byte_size,
    url: brandAssetUrl(row.id),
  })
}

export class PostgresBrandingStore implements BrandingStore {
  constructor(private readonly database: Kysely<BrandingDatabase>) {}

  async root(tenantId: TenantId, lock = false) {
    let query = this.database
      .selectFrom('branding.brand_profile')
      .select(['id', 'published_version_id'])
      .where('tenant_id', '=', tenantId)
    if (lock) query = query.forUpdate()
    const row = await query.executeTakeFirst()
    return row === undefined ? null : { id: row.id, publishedVersionId: row.published_version_id }
  }

  async ensureRoot(context: ApplicationContext) {
    const now = new Date()
    await this.database
      .insertInto('branding.brand_profile')
      .values({
        id: newEntityId(),
        tenant_id: context.tenantId,
        published_version_id: null,
        created_at: now,
        created_by: context.userId,
        updated_at: now,
        updated_by: context.userId,
      })
      .onConflict((conflict) => conflict.column('tenant_id').doNothing())
      .execute()
    const root = await this.root(context.tenantId, true)
    if (root === null) throw new Error('Brand profile creation failed')
    return root
  }

  async list(tenantId: TenantId) {
    const root = await this.root(tenantId)
    if (root === null) return { publishedVersionId: null, versions: [] }
    const rows = await this.database
      .selectFrom('branding.brand_version')
      .select(['id', 'version', 'edit_revision', 'status', 'published_at'])
      .where('tenant_id', '=', tenantId)
      .where('profile_id', '=', root.id)
      .orderBy('version', 'desc')
      .execute()
    return {
      publishedVersionId: root.publishedVersionId,
      versions: rows.map((row) => ({
        id: row.id,
        revision: row.version,
        editRevision: row.edit_revision,
        status: row.status,
        publishedAt: row.published_at?.toISOString() ?? null,
      })),
    }
  }

  async version(tenantId: TenantId, id: string): Promise<BrandVersion | null> {
    const row = await this.database
      .selectFrom('branding.brand_version')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('id', '=', id)
      .executeTakeFirst()
    if (row === undefined) return null
    const assetIds = [row.logo_asset_id, row.mark_asset_id, row.favicon_asset_id].filter(
      (value): value is string => value !== null,
    )
    const assets =
      assetIds.length === 0
        ? []
        : await this.database
            .selectFrom('branding.brand_asset')
            .selectAll()
            .where('tenant_id', '=', tenantId)
            .where('id', 'in', assetIds)
            .execute()
    const byId = new Map(assets.map((asset) => [asset.id, assetMetadata(asset)]))
    return brandVersionSchema.parse({
      id: row.id,
      revision: row.version,
      editRevision: row.edit_revision,
      status: row.status,
      publishedAt: row.published_at?.toISOString() ?? null,
      systemName: row.system_name,
      shortName: row.short_name,
      loginTitle: row.login_title,
      loginTagline: row.login_tagline,
      titleMode: row.title_mode,
      horizontalBrandMode: row.horizontal_brand_mode,
      logoColorMode: row.logo_color_mode,
      logoAssetId: row.logo_asset_id,
      markAssetId: row.mark_asset_id,
      faviconAssetId: row.favicon_asset_id,
      visualTheme: {
        schemaVersion: 2,
        basePalette: row.theme_base_palette,
        primaryPalette: row.theme_primary_palette,
        customBasePalette: row.theme_custom_base_palette,
        customPrimaryPalette: row.theme_custom_primary_palette,
        radius: row.theme_radius,
        sidebarScheme: row.theme_sidebar_scheme,
        feedbackScheme: row.theme_feedback_scheme,
        chartScheme: row.theme_chart_scheme,
        lightLevel: row.theme_light_level,
        darkLevel: row.theme_dark_level,
        borderOpacity: row.theme_border_opacity,
        overrides: row.theme_overrides,
      },
      workspaceDefaults: {
        layoutMode: row.workspace_layout_mode,
        brandPlacement: row.workspace_brand_placement,
        headerHeight: row.workspace_header_height,
        siderWidth: row.workspace_sider_width,
        showTabs: row.workspace_show_tabs,
      },
      logoAsset: row.logo_asset_id === null ? null : (byId.get(row.logo_asset_id) ?? null),
      markAsset: row.mark_asset_id === null ? null : (byId.get(row.mark_asset_id) ?? null),
      faviconAsset: row.favicon_asset_id === null ? null : (byId.get(row.favicon_asset_id) ?? null),
    })
  }

  async published(tenantId: TenantId) {
    const root = await this.root(tenantId)
    return root?.publishedVersionId ? this.version(tenantId, root.publishedVersionId) : null
  }

  async nextRevision(tenantId: TenantId) {
    const result = await this.database
      .selectFrom('branding.brand_version')
      .select((expression) => expression.fn.max('version').as('maximum'))
      .where('tenant_id', '=', tenantId)
      .executeTakeFirst()
    return (result?.maximum ?? 0) + 1
  }

  async insertVersion(context: ApplicationContext, rootId: string, version: BrandVersion) {
    await this.database
      .insertInto('branding.brand_version')
      .values({
        id: version.id,
        tenant_id: context.tenantId,
        profile_id: rootId,
        version: version.revision,
        edit_revision: 0,
        status: 'DRAFT',
        system_name: version.systemName,
        short_name: version.shortName,
        login_title: version.loginTitle,
        login_tagline: version.loginTagline,
        title_mode: version.titleMode,
        horizontal_brand_mode: version.horizontalBrandMode,
        logo_color_mode: version.logoColorMode,
        logo_asset_id: version.logoAssetId,
        mark_asset_id: version.markAssetId,
        favicon_asset_id: version.faviconAssetId,
        theme_base_palette: version.visualTheme.basePalette,
        theme_primary_palette: version.visualTheme.primaryPalette,
        theme_custom_base_palette: version.visualTheme.customBasePalette,
        theme_custom_primary_palette: version.visualTheme.customPrimaryPalette,
        theme_radius: version.visualTheme.radius,
        theme_sidebar_scheme: version.visualTheme.sidebarScheme,
        theme_feedback_scheme: version.visualTheme.feedbackScheme,
        theme_chart_scheme: version.visualTheme.chartScheme,
        theme_light_level: version.visualTheme.lightLevel,
        theme_dark_level: version.visualTheme.darkLevel,
        theme_border_opacity: version.visualTheme.borderOpacity,
        theme_overrides: version.visualTheme.overrides,
        workspace_layout_mode: version.workspaceDefaults.layoutMode,
        workspace_brand_placement: version.workspaceDefaults.brandPlacement,
        workspace_header_height: version.workspaceDefaults.headerHeight,
        workspace_sider_width: version.workspaceDefaults.siderWidth,
        workspace_show_tabs: version.workspaceDefaults.showTabs,
        created_at: new Date(),
        created_by: context.userId,
        published_at: null,
        published_by: null,
      })
      .execute()
  }

  async saveDraft(
    context: ApplicationContext,
    id: string,
    configuration: BrandConfiguration,
    expectedEditRevision: number,
  ) {
    const result = await this.database
      .updateTable('branding.brand_version')
      .set({
        system_name: configuration.systemName,
        short_name: configuration.shortName,
        login_title: configuration.loginTitle,
        login_tagline: configuration.loginTagline,
        title_mode: configuration.titleMode,
        horizontal_brand_mode: configuration.horizontalBrandMode,
        logo_color_mode: configuration.logoColorMode,
        logo_asset_id: configuration.logoAssetId,
        mark_asset_id: configuration.markAssetId,
        favicon_asset_id: configuration.faviconAssetId,
        theme_base_palette: configuration.visualTheme.basePalette,
        theme_primary_palette: configuration.visualTheme.primaryPalette,
        theme_custom_base_palette: configuration.visualTheme.customBasePalette,
        theme_custom_primary_palette: configuration.visualTheme.customPrimaryPalette,
        theme_radius: configuration.visualTheme.radius,
        theme_sidebar_scheme: configuration.visualTheme.sidebarScheme,
        theme_feedback_scheme: configuration.visualTheme.feedbackScheme,
        theme_chart_scheme: configuration.visualTheme.chartScheme,
        theme_light_level: configuration.visualTheme.lightLevel,
        theme_dark_level: configuration.visualTheme.darkLevel,
        theme_border_opacity: configuration.visualTheme.borderOpacity,
        theme_overrides: configuration.visualTheme.overrides,
        workspace_layout_mode: configuration.workspaceDefaults.layoutMode,
        workspace_brand_placement: configuration.workspaceDefaults.brandPlacement,
        workspace_header_height: configuration.workspaceDefaults.headerHeight,
        workspace_sider_width: configuration.workspaceDefaults.siderWidth,
        workspace_show_tabs: configuration.workspaceDefaults.showTabs,
        edit_revision: expectedEditRevision + 1,
      })
      .where('tenant_id', '=', context.tenantId)
      .where('id', '=', id)
      .where('status', '=', 'DRAFT')
      .where('edit_revision', '=', expectedEditRevision)
      .executeTakeFirst()
    return result.numUpdatedRows === 1n
  }

  async markPublished(context: ApplicationContext, id: string, expectedEditRevision: number) {
    const result = await this.database
      .updateTable('branding.brand_version')
      .set({ status: 'PUBLISHED', published_at: new Date(), published_by: context.userId })
      .where('tenant_id', '=', context.tenantId)
      .where('id', '=', id)
      .where('status', '=', 'DRAFT')
      .where('edit_revision', '=', expectedEditRevision)
      .executeTakeFirst()
    return result.numUpdatedRows === 1n
  }

  async pointPublished(context: ApplicationContext, rootId: string, versionId: string | null) {
    await this.database
      .updateTable('branding.brand_profile')
      .set({
        published_version_id: versionId,
        updated_at: new Date(),
        updated_by: context.userId,
      })
      .where('tenant_id', '=', context.tenantId)
      .where('id', '=', rootId)
      .executeTakeFirstOrThrow()
  }

  async deleteDraft(context: ApplicationContext, id: string) {
    const result = await this.database
      .deleteFrom('branding.brand_version')
      .where('tenant_id', '=', context.tenantId)
      .where('id', '=', id)
      .where('status', '=', 'DRAFT')
      .executeTakeFirst()
    return result.numDeletedRows === 1n
  }

  async insertAsset(
    context: ApplicationContext,
    purpose: BrandAssetPurpose,
    bytes: Uint8Array,
    metadata: Omit<BrandAsset, 'id' | 'purpose' | 'url'>,
  ) {
    const digest = createHash('sha256').update(bytes).digest('hex')
    const existing = await this.database
      .selectFrom('branding.brand_asset')
      .selectAll()
      .where('tenant_id', '=', context.tenantId)
      .where('purpose', '=', purpose)
      .where('sha256', '=', digest)
      .executeTakeFirst()
    if (existing !== undefined) return assetMetadata(existing)
    const row: AssetRow = {
      id: newEntityId(),
      tenant_id: context.tenantId,
      purpose,
      content_type: metadata.contentType,
      validation_profile: metadata.validationProfile,
      sha256: digest,
      width: metadata.width,
      height: metadata.height,
      byte_size: metadata.byteSize,
      payload: bytes,
      created_at: new Date(),
      created_by: context.userId,
    }
    await this.database.insertInto('branding.brand_asset').values(row).execute()
    return assetMetadata(row)
  }

  async assetsExist(
    tenantId: TenantId,
    references: readonly { id: string; purpose: BrandAssetPurpose }[],
  ) {
    if (references.length === 0) return true
    const rows = await this.database
      .selectFrom('branding.brand_asset')
      .select(['id', 'purpose'])
      .where('tenant_id', '=', tenantId)
      .where(
        'id',
        'in',
        references.map(({ id }) => id),
      )
      .execute()
    const actual = new Map(rows.map((row) => [row.id, row.purpose]))
    return references.every(({ id, purpose }) => actual.get(id) === purpose)
  }

  async publicAsset(id: string): Promise<StoredBrandAsset | null> {
    const row = await this.database
      .selectFrom('branding.brand_asset')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
    return row === undefined ? null : { ...assetMetadata(row), bytes: row.payload }
  }
}

export class PostgresBrandingUnitOfWork implements BrandingUnitOfWork {
  constructor(private readonly database: Kysely<BrandingDatabase>) {}

  run<T>(work: (transaction: BrandingTransaction) => Promise<T>): Promise<T> {
    return this.database.transaction().execute(async (transaction) => {
      const audit = new PostgresAuditWriter(transaction)
      return work({
        store: new PostgresBrandingStore(transaction),
        record: (context, action, entityType, entityId, before, after) =>
          audit.append({
            context,
            module: 'branding',
            action,
            entityType,
            entityId,
            result: 'SUCCESS',
            before,
            after,
          }),
      })
    })
  }
}
