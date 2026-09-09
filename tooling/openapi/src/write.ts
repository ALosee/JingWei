import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

function destinationFor(rootDirectory: string, moduleId: string): string {
  return resolve(
    rootDirectory,
    'packages',
    'modules',
    moduleId,
    'src',
    'client',
    'generated',
    'openapi.ts',
  )
}

export async function writeModuleClientTypes(options: {
  readonly rootDirectory: string
  readonly moduleId: string
  readonly source: string
}): Promise<string> {
  const destination = destinationFor(options.rootDirectory, options.moduleId)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, options.source, 'utf8')
  return destination
}

export async function checkModuleClientTypes(options: {
  readonly rootDirectory: string
  readonly moduleId: string
  readonly source: string
}): Promise<string> {
  const destination = destinationFor(options.rootDirectory, options.moduleId)
  const current = await readFile(destination, 'utf8').catch(() => null)
  if (current !== options.source)
    throw new Error(
      `${options.moduleId} OpenAPI types are stale; run \`pnpm api:generate\` and commit the result`,
    )
  return destination
}
