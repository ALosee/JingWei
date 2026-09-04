import { describe, expect, it } from 'vitest'

import { extractImports } from './index.js'

describe('extractImports', () => {
  it('finds static, export-from and dynamic imports', () => {
    expect(
      extractImports(`
        import { value } from '@jingwei/kernel'
        export { api } from '@jingwei/module-iam/server/public'
        const page = import('./Page.vue')
      `),
    ).toEqual(['@jingwei/kernel', '@jingwei/module-iam/server/public', './Page.vue'])
  })
})
