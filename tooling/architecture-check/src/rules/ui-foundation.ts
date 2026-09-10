import type { ArchitectureViolation } from '../contracts.js'

interface PackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
  readonly optionalDependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
}

/** Keep the styled UI implementation source-owned instead of package-owned. */
export function inspectUiPackageManifest(file: string, content: string): ArchitectureViolation[] {
  const manifest: unknown = JSON.parse(content)

  if (typeof manifest !== 'object' || manifest === null) {
    throw new Error(`${file} is not a JSON object`)
  }

  const packageManifest = manifest as PackageManifest
  const dependencies = {
    ...packageManifest.dependencies,
    ...packageManifest.devDependencies,
    ...packageManifest.optionalDependencies,
    ...packageManifest.peerDependencies,
  }

  if (!('@soybeanjs/ui' in dependencies)) return []

  return [
    {
      file,
      rule: 'source-controlled-ui',
      message: 'The styled @soybeanjs/ui package is forbidden; own generated source in @jingwei/ui',
    },
  ]
}
