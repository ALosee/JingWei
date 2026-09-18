import type { BrandAdmin } from '../../shared/index.js'

/** Selects the live version by default, or the platform default when no version is live. */
export function resolveBrandVersionSelection(
  admin: BrandAdmin,
  preferredVersionId?: string | null,
): string | null {
  return preferredVersionId === undefined ? admin.publishedVersionId : preferredVersionId
}
