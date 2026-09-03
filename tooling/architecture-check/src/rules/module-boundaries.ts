import { readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'

import { type DiscoveredModule } from '@jingwei/edition-builder'
import { defineEdition, resolveEdition } from '@jingwei/module-sdk'

import type { ArchitectureViolation } from '../contracts.js'
import { listSourceFiles } from '../source-files.js'

const importPattern = /(?:import|export)\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gu

export async function checkModuleBoundaries(repositoryRoot: string, modules: readonly DiscoveredModule[]): Promise<ArchitectureViolation[]> {
  assertAcyclic(modules)
  const schemaOwners = new Map([
    ['platform', '@jingwei/platform'],
    ...modules.map(({ manifest }) => [manifest.id, manifest.id] as const),
  ])
  const violations: ArchitectureViolation[] = []

  for (const module of modules) {
    const packageJson = await readPackageJson(join(module.directory, 'package.json'))
    if (Object.keys(packageJson.exports ?? {}).includes('./*')) {
      violations.push({
        file: relative(repositoryRoot, join(module.directory, 'package.json')),
        rule: 'strict-exports',
        message: 'Wildcard package export "./*" is forbidden',
      })
    }
    inspectPackageDependencies(repositoryRoot, module, modules, packageJson, violations)

    const files = await listSourceFiles(module.directory)
    for (const file of files) {
      const content = await readFile(file, 'utf8')
      for (const specifier of extractImports(content)) {
        inspectImport({
          repositoryRoot,
          module,
          modules,
          file,
          specifier,
          violations,
        })
      }
      inspectDatabaseOwnership(
        repositoryRoot,
        module,
        file,
        content,
        schemaOwners,
        violations,
      )
    }
  }

  return violations
}

export function extractImports(content: string): readonly string[] {
  return [...content.matchAll(importPattern)]
    .map((match) => match[1] ?? match[2])
    .filter((value): value is string => value !== undefined)
}

function inspectImport(options: {
  readonly repositoryRoot: string
  readonly module: DiscoveredModule
  readonly modules: readonly DiscoveredModule[]
  readonly file: string
  readonly specifier: string
  readonly violations: ArchitectureViolation[]
}): void {
  const { repositoryRoot, module, modules, file, specifier, violations } = options
  const fileLabel = relative(repositoryRoot, file)

  if (specifier.startsWith('.')) {
    const resolved = resolve(dirname(file), specifier)
    const target = modules.find(({ directory }) => isInside(resolved, directory))
    if (target !== undefined && target.manifest.id !== module.manifest.id) {
      violations.push({
        file: fileLabel,
        rule: 'no-cross-module-relative-import',
        message: `Relative import crosses into module ${target.manifest.id}: ${specifier}`,
      })
    }
    return
  }

  const target = modules.find(({ manifest }) => {
    const packageName = `@jingwei/module-${manifest.id}`
    return specifier === packageName || specifier.startsWith(`${packageName}/`)
  })
  if (target === undefined) {
    if (/^@jingwei\/module-(?!sdk(?:\/|$))/u.test(specifier)) {
      violations.push({
        file: fileLabel,
        rule: 'unknown-module-package-reference',
        message: `Import references a module outside the catalog: ${specifier}`,
      })
    }
    return
  }
  if (target.manifest.id === module.manifest.id) return
  const targetId = target.manifest.id
  const packageName = `@jingwei/module-${targetId}`
  const subpath = specifier === packageName ? '' : specifier.slice(packageName.length + 1)

  if (subpath === 'src' || subpath.startsWith('src/')) {
    violations.push({
      file: fileLabel,
      rule: 'no-private-module-import',
      message: `Private source import is forbidden: ${specifier}`,
    })
  }
  if (
    subpath === 'server' ||
    subpath.startsWith('server/') && subpath !== 'server/public' ||
    subpath === 'web' ||
    subpath.startsWith('web/') ||
    subpath === 'migrations' ||
    subpath.startsWith('migrations/')
  ) {
    violations.push({
      file: fileLabel,
      rule: 'cross-module-public-api-only',
      message: `Cross-module runtime import is not a public contract: ${specifier}`,
    })
  }
  if (file.includes(`${sep}web${sep}`) && subpath.startsWith('server')) {
    violations.push({
      file: fileLabel,
      rule: 'web-cannot-import-server',
      message: `Web source imports server runtime: ${specifier}`,
    })
  }
  if (file.includes(`${sep}server${sep}`) && subpath.startsWith('web')) {
    violations.push({
      file: fileLabel,
      rule: 'server-cannot-import-web',
      message: `Server source imports web runtime: ${specifier}`,
    })
  }

  const declared = new Set([
    ...module.manifest.dependencies,
    ...module.manifest.optionalDependencies,
  ])
  if (!declared.has(targetId)) {
    violations.push({
      file: fileLabel,
      rule: 'manifest-dependency-required',
      message: `Import of ${targetId} is not declared in ${module.manifest.id} manifest`,
    })
  }
}

function inspectPackageDependencies(
  repositoryRoot: string,
  module: DiscoveredModule,
  modules: readonly DiscoveredModule[],
  packageJson: PackageJson,
  violations: ArchitectureViolation[],
): void {
  const declared = new Set([
    ...module.manifest.dependencies,
    ...module.manifest.optionalDependencies,
  ])
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.optionalDependencies,
  }

  for (const packageName of Object.keys(dependencies)) {
    if (packageName === '@jingwei/module-sdk') continue
    const target = modules.find(
      ({ manifest }) => packageName === `@jingwei/module-${manifest.id}`,
    )
    if (target === undefined) {
      if (packageName.startsWith('@jingwei/module-')) {
        violations.push({
          file: relative(repositoryRoot, join(module.directory, 'package.json')),
          rule: 'unknown-module-package-reference',
          message: `Package dependency references a module outside the catalog: ${packageName}`,
        })
      }
      continue
    }
    if (target.manifest.id !== module.manifest.id && !declared.has(target.manifest.id)) {
      violations.push({
        file: relative(repositoryRoot, join(module.directory, 'package.json')),
        rule: 'manifest-dependency-required',
        message: `Package dependency ${packageName} is not declared in ${module.manifest.id} manifest`,
      })
    }
  }
}

function inspectDatabaseOwnership(
  repositoryRoot: string,
  module: DiscoveredModule,
  file: string,
  content: string,
  schemaOwners: ReadonlyMap<string, string>,
  violations: ArchitectureViolation[],
): void {
  for (const [schema, owner] of schemaOwners) {
    if (owner === module.manifest.id) continue
    const escaped = schema.replaceAll('-', '_')
    const patterns = [
      new RegExp(`(?:selectFrom|insertInto|updateTable|deleteFrom)\\(\\s*['"]${escaped}\\.`, 'u'),
      new RegExp(`withSchema\\(\\s*['"]${escaped}['"]`, 'u'),
      new RegExp(`\\b(?:FROM|JOIN|UPDATE|INTO|TABLE)\\s+${escaped}\\.`, 'iu'),
    ]
    if (patterns.some((pattern) => pattern.test(content))) {
      violations.push({
        file: relative(repositoryRoot, file),
        rule: 'module-database-ownership',
        message: `Module ${module.manifest.id} accesses schema owned by ${owner}`,
      })
    }
  }
}

function assertAcyclic(modules: readonly DiscoveredModule[]): void {
  const selections: Record<string, true> = Object.fromEntries(
    modules.map(({ manifest }) => [manifest.id, true]),
  )
  resolveEdition(
    defineEdition({ id: 'architecture-check', modules: selections }),
    modules.map(({ manifest }) => manifest),
  )
}

function isInside(target: string, root: string): boolean {
  const path = relative(root, target)
  return path !== '..' && !path.startsWith(`..${sep}`) && !path.startsWith(sep)
}

interface PackageJson {
  readonly exports?: Readonly<Record<string, unknown>>
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
  readonly optionalDependencies?: Readonly<Record<string, string>>
}

async function readPackageJson(path: string): Promise<PackageJson> {
  const value: unknown = JSON.parse(await readFile(path, 'utf8'))
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${path} is not a JSON object`)
  }
  return value
}
