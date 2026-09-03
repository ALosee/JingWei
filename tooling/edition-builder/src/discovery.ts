import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { ModuleManifest } from '@jingwei/module-sdk'

interface ManifestModule {
  readonly manifest?: ModuleManifest
}

export interface DiscoveredModule {
  readonly directory: string
  readonly manifest: ModuleManifest
}

export async function discoverModules(repositoryRoot: string): Promise<DiscoveredModule[]> {
  const modulesRoot = join(repositoryRoot, 'packages/modules')
  const entries = await readdir(modulesRoot, { withFileTypes: true })
  const discovered: DiscoveredModule[] = []

  for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
    const manifestPath = join(modulesRoot, entry.name, 'src/manifest.ts')
    const loaded: unknown = await import(pathToFileURL(manifestPath).href)
    if (!isManifestModule(loaded) || loaded.manifest === undefined) {
      throw new Error(`${manifestPath} must export manifest`)
    }
    if (loaded.manifest.id !== entry.name) {
      throw new Error(
        `Module directory ${entry.name} does not match manifest id ${loaded.manifest.id}`,
      )
    }
    discovered.push({ directory: join(modulesRoot, entry.name), manifest: loaded.manifest })
  }

  return discovered.sort((left, right) => left.manifest.id.localeCompare(right.manifest.id))
}

function isManifestModule(value: unknown): value is ManifestModule {
  return typeof value === 'object' && value !== null && 'manifest' in value
}
