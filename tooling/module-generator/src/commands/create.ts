import { resolve } from 'node:path'

import { generateModule } from '../generate.js'

export async function runModuleCommand(): Promise<void> {
  const moduleId = process.argv[2]
  if (moduleId === undefined) throw new Error('Usage: pnpm module:create <kebab-case-name>')
  await generateModule(resolve(import.meta.dirname, '../../../..'), moduleId)
  console.log(
    `Created module ${moduleId}. Add server/web module implementations and enable it in an edition.`,
  )
}
