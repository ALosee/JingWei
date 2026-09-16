import { describe, expect, it } from 'vitest'

import { serverModulesSource, webModulesSource } from './generate.js'

describe('Edition integration generation', () => {
  it('omits Organization providers from an IAM-only Edition', () => {
    const server = serverModulesSource(['iam'])
    const web = webModulesSource(['iam'])

    expect(server).toContain('serverModule as iamServerModule')
    expect(server).not.toContain('OrganizationalScopeFacts')
    expect(server).not.toContain('module-organization')
    expect(web).not.toContain('customScopeReferenceDirectoryKey')
    expect(web).not.toContain('module-organization')
  })

  it('emits explicit server and Vue composition when Organization is enabled', () => {
    const server = serverModulesSource(['iam', 'organization'])
    const web = webModulesSource(['iam', 'organization'])

    expect(server).toContain('createOrganizationalScopeFacts(context.database)')
    expect(server).toContain('createIamServerModule({ organizationalScopeFacts })')
    expect(server).toContain('createOrganizationServerModule({ organizationalScopeFacts })')
    expect(web).toContain(
      'app.provide(customScopeReferenceDirectoryKey, organizationalScopeReferenceDirectory)',
    )
  })
})
