import type { TenantId } from '@jingwei/kernel'

import { brandAssetUrl, defaultEffectiveBrand, type EffectiveBrand } from '../../shared/index.js'
import type { BrandingStore, StoredBrandAsset } from './branding-store.js'

function assetUrl(asset: { id: string } | null): string | null {
  return asset === null ? null : brandAssetUrl(asset.id)
}

export class ResolveBranding {
  constructor(private readonly store: BrandingStore) {}

  async effective(tenantId: TenantId): Promise<EffectiveBrand> {
    const version = await this.store.published(tenantId)
    if (version === null) return defaultEffectiveBrand
    return {
      schemaVersion: 4,
      source: 'PUBLISHED',
      publishedRevision: version.revision,
      systemName: version.systemName,
      shortName: version.shortName,
      loginTitle: version.loginTitle,
      loginTagline: version.loginTagline,
      titleMode: version.titleMode,
      horizontalBrandMode: version.horizontalBrandMode,
      logoColorMode: version.logoColorMode,
      logoUrl: assetUrl(version.logoAsset),
      logoContentType: version.logoAsset?.contentType ?? null,
      markUrl: assetUrl(version.markAsset),
      markContentType: version.markAsset?.contentType ?? null,
      faviconUrl: assetUrl(version.faviconAsset),
      faviconContentType: version.faviconAsset?.contentType ?? null,
      visualTheme: version.visualTheme,
      workspaceDefaults: version.workspaceDefaults,
    }
  }

  asset(id: string): Promise<StoredBrandAsset | null> {
    return this.store.publicAsset(id)
  }
}
