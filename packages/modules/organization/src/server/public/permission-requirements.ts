import { definePermissionRequirement } from '@jingwei/module-sdk'

/** Organization-owned requirements reused by Application enforcement and API contracts. */
export const organizationPermissionRequirements = Object.freeze({
  view: definePermissionRequirement({
    permission: 'organization.view',
    capability: 'organization.core',
    scope: 'SCOPED',
  }),
  manage: definePermissionRequirement({
    permission: 'organization.manage',
    capability: 'organization.core',
    scope: 'UNSCOPED',
  }),
})
