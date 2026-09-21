import { getBrandAssetText, getBrandBootstrap } from '../client/index.js'
import { validateEffectiveBrandAssets } from './effective-brand-validation.js'

/** Loads the public projection and verifies immutable SVG bytes before global rendering. */
export async function loadEffectiveBrand(
  tenantCode?: string,
): ReturnType<typeof getBrandBootstrap> {
  return validateEffectiveBrandAssets(await getBrandBootstrap(tenantCode), getBrandAssetText)
}
