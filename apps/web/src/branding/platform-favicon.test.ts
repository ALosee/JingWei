import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

describe('platform favicon', () => {
  it('uses the UI default indigo as its stable product color', async () => {
    const source = await readFile(new URL('../../public/favicon.svg', import.meta.url), 'utf8')

    expect(source).toContain('fill="#4f46e5"')
  })
})
