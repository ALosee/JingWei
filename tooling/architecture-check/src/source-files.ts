import { readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'

const sourceExtensions = new Set(['.ts', '.tsx', '.vue'])
const excludedDirectories = new Set([
  'node_modules',
  'dist',
  'generated',
  '_generated',
  'test-results',
  'playwright-report',
])

/** Scan authored sources, never generated code or build/runtime dependencies. */
export async function listSourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const nested = await Promise.all(
    entries
      .filter(({ name }) => !excludedDirectories.has(name))
      .map(async (entry) => {
        const path = join(root, entry.name)
        return entry.isDirectory()
          ? listSourceFiles(path)
          : sourceExtensions.has(extname(entry.name))
            ? [path]
            : []
      }),
  )
  return nested.flat()
}

/** List workspace manifests without traversing dependencies or build output. */
export async function listPackageJsonFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const nested = await Promise.all(
    entries
      .filter(({ name }) => !excludedDirectories.has(name))
      .map(async (entry) => {
        const path = join(root, entry.name)
        if (entry.isDirectory()) return listPackageJsonFiles(path)
        return entry.name === 'package.json' ? [path] : []
      }),
  )
  return nested.flat()
}
