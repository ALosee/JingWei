import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { moduleFiles } from './templates.js'

const directories = [
  'src/shared',
  'src/server/domain',
  'src/server/application',
  'src/server/infrastructure',
  'src/server/public',
  'src/server/api',
  'src/client',
  'src/web/pages',
  'src/web/components',
  'src/web/composables',
  'migrations',
]

/** Writes only a newly created module directory; existing targets are never overwritten. */
export async function generateModule(repositoryRoot: string, moduleId: string): Promise<void> {
  if (!/^[a-z][a-z0-9-]*$/u.test(moduleId)) throw new Error('Usage: pnpm module:create <kebab-case-name>')
  const moduleRoot = join(repositoryRoot, 'packages/modules', moduleId)
  await mkdir(moduleRoot)
  await Promise.all(directories.map((directory) => mkdir(join(moduleRoot, directory), { recursive: true })))
  await Promise.all(Object.entries(moduleFiles(moduleId)).map(([path, content]) =>
    writeFile(join(moduleRoot, path), content, 'utf8'),
  ))
}
