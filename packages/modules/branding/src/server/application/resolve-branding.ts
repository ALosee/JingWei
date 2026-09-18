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
      schemaVersion: 2,
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
      faviconUrl: assetUrl(version.faviconAsset),
    }
  }

  asset(id: string): Promise<StoredBrandAsset | null> {
    return this.store.publicAsset(id)
  }
}
