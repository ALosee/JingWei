import { definePermissionRequirement } from '@jingwei/module-sdk'

export const brandingPermissionRequirements = Object.freeze({
  view: definePermissionRequirement({
    permission: 'branding.view',
    capability: 'branding.core',
    scope: 'UNSCOPED',
  }),
  manage: definePermissionRequirement({
    permission: 'branding.manage',
    capability: 'branding.core',
    scope: 'UNSCOPED',
  }),
  publish: definePermissionRequirement({
    permission: 'branding.publish',
    capability: 'branding.core',
    scope: 'UNSCOPED',
  }),
})
