import { getBrandAssetText, getBrandBootstrap } from '../client/index.js'
import { validateEffectiveBrandLogo } from './effective-brand-validation.js'

/** Loads the public projection and verifies immutable SVG bytes before global rendering. */
export async function loadEffectiveBrand(): ReturnType<typeof getBrandBootstrap> {
  return validateEffectiveBrandLogo(await getBrandBootstrap(), getBrandAssetText)
}
