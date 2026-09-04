import { expect, it } from 'vitest'

import { loadConfig } from './index.js'

it('validates and normalizes the anonymous bootstrap tenant without accepting an empty code', () => {
  expect(loadConfig({}).bootstrapTenantCode).toBe('default')
  expect(loadConfig({ BOOTSTRAP_TENANT_CODE: ' tenant-a ' }).bootstrapTenantCode).toBe('tenant-a')
  expect(() => loadConfig({ BOOTSTRAP_TENANT_CODE: ' ' })).toThrow()
})
