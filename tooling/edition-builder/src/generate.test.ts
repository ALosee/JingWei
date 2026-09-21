import { describe, expect, it } from 'vitest'

import {
  assertControlPlaneFoundationModules,
  migrationsSource,
  serverModulesSource,
  webModulesSource,
} from './generate.js'

describe('Edition integration generation', () => {
  it('requires the foundation modules used by tenant provisioning', () => {
    expect(() => assertControlPlaneFoundationModules(['iam', 'navigation'])).not.toThrow()
    expect(() => assertControlPlaneFoundationModules(['iam'])).toThrow(
      'required foundation modules: navigation',
    )
    expect(() => assertControlPlaneFoundationModules(['navigation'])).toThrow(
      'required foundation modules: iam',
    )
  })

  it('always includes tenancy and control-plane migrations before edition modules', () => {
    const migrations = migrationsSource(['iam'])

    expect(migrations).toContain('@jingwei/tenancy/migrations')
    expect(migrations.indexOf('...tenancyMigrations')).toBeLessThan(
      migrations.indexOf('...iamMigrations'),
    )
    expect(migrations).toContain('@jingwei/control-plane/migrations')
    expect(migrations.indexOf('...controlPlaneMigrations')).toBeLessThan(
      migrations.indexOf('...iamMigrations'),
    )
  })

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
