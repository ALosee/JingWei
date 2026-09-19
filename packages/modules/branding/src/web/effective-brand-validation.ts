import type { BrandAssetContentType, BrandSvgPurpose, EffectiveBrand } from '../shared/index.js'
import { validateBrandSvgText } from './brand-logo-svg-validation.js'

const assetUrlPrefix = '/api/v1/branding/assets/'

function assetIdFromUrl(url: string): string | null {
  if (!url.startsWith(assetUrlPrefix)) return null
  const id = url.slice(assetUrlPrefix.length)
  return /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id) ? id : null
}

async function safeSvg<ContentType extends BrandAssetContentType>(
  purpose: BrandSvgPurpose,
  url: string | null,
  contentType: ContentType | null,
  loadAssetText: (id: string) => Promise<string>,
): Promise<{ url: string | null; contentType: ContentType | null }> {
  if (contentType !== 'image/svg+xml' || url === null) return { url, contentType }
  const id = assetIdFromUrl(url)
  if (id === null) return { url: null, contentType: null }
  try {
    validateBrandSvgText(await loadAssetText(id), purpose)
    return { url, contentType }
  } catch {
    return { url: null, contentType: null }
  }
}

/** Revalidates immutable SVG bytes before they enter the browser-wide active brand projection. */
export async function validateEffectiveBrandAssets(
  brand: EffectiveBrand,
  loadAssetText: (id: string) => Promise<string>,
): Promise<EffectiveBrand> {
  const [logo, mark] = await Promise.all([
    safeSvg('LOGO', brand.logoUrl, brand.logoContentType, loadAssetText),
    safeSvg('MARK', brand.markUrl, brand.markContentType, loadAssetText),
  ])
  if (
    logo.url === brand.logoUrl &&
    logo.contentType === brand.logoContentType &&
    mark.url === brand.markUrl &&
    mark.contentType === brand.markContentType
  )
    return brand
  return {
    ...brand,
    logoUrl: logo.url,
    logoContentType: logo.contentType,
    markUrl: mark.url,
    markContentType: mark.contentType,
  }
}
