import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { generateModule } from './generate.js'
import { moduleFiles } from './templates.js'

it('separates deterministic templates from filesystem work and never overwrites an existing module', async () => {
  expect(moduleFiles('sample')).toEqual(moduleFiles('sample'))
  const root = await mkdtemp(join(tmpdir(), 'jingwei-generator-test-'))
  try {
    await mkdir(join(root, 'packages/modules'), { recursive: true })
    await generateModule(root, 'sample')
    const index = join(root, 'packages/modules/sample/src/server/index.ts')
    expect(await readFile(index, 'utf8')).toBe("export { serverModule } from './module.js'\n")
    await expect(generateModule(root, 'sample')).rejects.toThrow()
    expect(await readFile(index, 'utf8')).toBe(moduleFiles('sample')['src/server/index.ts'])
    await expect(generateModule(root, '../escape')).rejects.toThrow('Usage')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
