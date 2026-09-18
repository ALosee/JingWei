import type { EffectiveBrand } from '../shared/index.js'
import { validateBrandLogoSvgText } from './brand-logo-svg-validation.js'

const assetUrlPrefix = '/api/v1/branding/assets/'

function logoAssetId(url: string): string | null {
  if (!url.startsWith(assetUrlPrefix)) return null
  const id = url.slice(assetUrlPrefix.length)
  return /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id) ? id : null
}

/** Revalidates immutable SVG bytes before they enter the browser-wide active brand projection. */
export async function validateEffectiveBrandLogo(
  brand: EffectiveBrand,
  loadAssetText: (id: string) => Promise<string>,
): Promise<EffectiveBrand> {
  if (brand.logoContentType !== 'image/svg+xml' || brand.logoUrl === null) return brand
  const id = logoAssetId(brand.logoUrl)
  if (id === null) return { ...brand, logoUrl: null, logoContentType: null }
  try {
    validateBrandLogoSvgText(await loadAssetText(id))
    return brand
  } catch {
    return { ...brand, logoUrl: null, logoContentType: null }
  }
}
