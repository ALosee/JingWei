import { resolve } from 'node:path'

import { generateEdition } from '../generate.js'

/** Explicit command boundary; importing this module performs no I/O. */
export async function runEditionCommand(): Promise<void> {
  const editionName = process.argv[2] ?? 'development'
  const repositoryRoot = resolve(import.meta.dirname, '../../../..')

  try {
    const edition = await generateEdition(repositoryRoot, editionName)
    console.log(
      `Generated edition ${edition.id}: ${edition.modules
        .map(({ manifest }) => manifest.id)
        .join(', ')}`,
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
