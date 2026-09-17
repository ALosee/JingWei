import { definePermissionRequirement } from '@jingwei/module-sdk'

/** IAM-owned permission requirements reused by Application enforcement and API contracts. */
export const iamPermissionRequirements = Object.freeze({
  roleView: definePermissionRequirement({
    permission: 'iam.role.view',
    capability: 'iam.authorization',
    scope: 'UNSCOPED',
  }),
  roleManage: definePermissionRequirement({
    permission: 'iam.role.manage',
    capability: 'iam.authorization',
    scope: 'UNSCOPED',
  }),
  userView: definePermissionRequirement({
    permission: 'iam.user.view',
    capability: 'iam.authentication',
    scope: 'UNSCOPED',
  }),
  userManage: definePermissionRequirement({
    permission: 'iam.user.manage',
    capability: 'iam.authentication',
    scope: 'UNSCOPED',
  }),
})
