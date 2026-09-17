import { definePermissionRequirement } from '@jingwei/module-sdk'

/** Dictionary-owned requirements are the single source for use cases and OpenAPI contracts. */
export const dictionaryPermissionRequirements = Object.freeze({
  view: definePermissionRequirement({
    permission: 'dictionary.view',
    capability: 'dictionary.core',
    scope: 'UNSCOPED',
  }),
  manage: definePermissionRequirement({
    permission: 'dictionary.manage',
    capability: 'dictionary.core',
    scope: 'UNSCOPED',
  }),
})
