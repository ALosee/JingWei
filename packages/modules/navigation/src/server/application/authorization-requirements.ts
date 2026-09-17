import { definePermissionRequirement } from '@jingwei/module-sdk'

/** Navigation-owned requirements are the single source for use cases and OpenAPI contracts. */
export const navigationPermissionRequirements = Object.freeze({
  view: definePermissionRequirement({
    permission: 'navigation.view',
    capability: 'navigation.core',
    scope: 'UNSCOPED',
  }),
  manage: definePermissionRequirement({
    permission: 'navigation.manage',
    capability: 'navigation.core',
    scope: 'UNSCOPED',
  }),
  publish: definePermissionRequirement({
    permission: 'navigation.publish',
    capability: 'navigation.core',
    scope: 'UNSCOPED',
  }),
})
