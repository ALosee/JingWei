import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { discoverModules } from '@jingwei/edition-builder'

import type { ArchitectureViolation } from './contracts.js'
import { checkModuleBoundaries } from './rules/module-boundaries.js'
import { inspectSourceResponsibilities } from './rules/source-responsibilities.js'
import { inspectUiPackageManifest } from './rules/ui-foundation.js'
import { listPackageJsonFiles, listSourceFiles } from './source-files.js'

export type { ArchitectureViolation } from './contracts.js'
export { extractImports } from './rules/module-boundaries.js'

/** Compose independent checks; rule implementations stay in their owning rule files. */
export async function checkArchitecture(repositoryRoot: string): Promise<ArchitectureViolation[]> {
  const modules = await discoverModules(repositoryRoot)
  const violations = await checkModuleBoundaries(repositoryRoot, modules)
  const rootPackageContent = await readFile(join(repositoryRoot, 'package.json'), 'utf8')
  const rootPackage: unknown = JSON.parse(rootPackageContent)
  violations.push(...inspectUiPackageManifest('package.json', rootPackageContent))
  const scripts =
    typeof rootPackage === 'object' && rootPackage !== null && 'scripts' in rootPackage
      ? rootPackage.scripts
      : null
  if (typeof scripts !== 'object' || scripts === null)
    throw new Error('Root package must declare scripts')
  const commands: unknown[] = Object.values(scripts)
  const commandEntrypoints = new Set(
    commands
      .filter((value): value is string => typeof value === 'string')
      .flatMap((command) =>
        [...command.matchAll(/\b(tooling\/[\w/-]+\.ts)\b/gu)].map((match) => match[1]),
      ),
  )
  const files = (
    await Promise.all(
      ['apps', 'packages', 'tooling'].map((directory) =>
        listSourceFiles(join(repositoryRoot, directory)),
      ),
    )
  ).flat()
  const packageFiles = (
    await Promise.all(
      ['apps', 'packages', 'tooling'].map((directory) =>
        listPackageJsonFiles(join(repositoryRoot, directory)),
      ),
    )
  ).flat()
  for (const file of packageFiles) {
    violations.push(
      ...inspectUiPackageManifest(relative(repositoryRoot, file), await readFile(file, 'utf8')),
    )
  }
  for (const file of files) {
    const label = relative(repositoryRoot, file)
    if (label.endsWith('.test.ts') || label.includes('/e2e/')) continue
    const entrypoint =
      /^apps\/[^/]+\/src\/(?:main|index)\.ts$/u.test(label) ||
      /^tooling\/[^/]+\/src\/cli\.ts$/u.test(label) ||
      commandEntrypoints.has(label)
    violations.push(
      ...inspectSourceResponsibilities(label, await readFile(file, 'utf8'), { entrypoint }),
    )
  }
  return violations
}
