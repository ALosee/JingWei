import type { ModuleManifest } from './manifest.js'

/**
 * Connects a stable manifest route key to a build-generated page component key.
 * Runtime URLs belong to Navigation and must not be encoded in this binding.
 */
export interface PageBinding {
  readonly routeKey: string
  readonly pageKey: string
}

/** Static, Edition-safe web contribution of one module. */
export interface WebModule {
  readonly manifest: ModuleManifest
  readonly pages: readonly PageBinding[]
}
