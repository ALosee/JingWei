import { resolve } from 'node:path'

import { checkArchitecture } from '../index.js'

/** Explicit command boundary; importing this module performs no I/O. */
export async function runArchitectureCommand(): Promise<void> {
  const repositoryRoot = resolve(import.meta.dirname, '../../../..')

  try {
    const violations = await checkArchitecture(repositoryRoot)
    if (violations.length === 0) {
      console.log('Architecture check passed')
    } else {
      for (const violation of violations) {
        console.error(`${violation.file}: [${violation.rule}] ${violation.message}`)
      }
      process.exitCode = 1
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
