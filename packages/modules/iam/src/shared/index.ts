import { z } from 'zod'

export const loginInputSchema = z
  .object({
    tenantCode: z.string().trim().min(1).max(80),
    login: z.string().trim().min(1).max(320),
    password: z.string().min(1).max(1_024),
  })
  .meta({ id: 'IamLoginInput', description: 'Credentials used to create an opaque token family' })

export const authenticatedUserSchema = z
  .object({
    id: z.uuid(),
    tenantId: z.uuid(),
    displayName: z.string(),
    avatarUrl: z.string().max(512).nullable(),
  })
  .meta({ id: 'IamAuthenticatedUser' })

export const loginResultSchema = z
  .object({
    user: authenticatedUserSchema,
    session: z.object({
      accessExpiresAt: z.iso.datetime(),
      absoluteExpiresAt: z.iso.datetime(),
    }),
  })
  .meta({ id: 'IamLoginResult' })

export const sessionStatusSchema = z
  .discriminatedUnion('authenticated', [
    z.object({ authenticated: z.literal(false) }),
    z.object({
      authenticated: z.literal(true),
      user: authenticatedUserSchema,
    }),
  ])
  .meta({ id: 'IamSessionStatus' })

export const refreshSessionResultSchema = z
  .object({
    accessExpiresAt: z.iso.datetime(),
    absoluteExpiresAt: z.iso.datetime(),
  })
  .meta({ id: 'IamRefreshSessionResult' })

export const accountProfileSchema = z
  .object({
    id: z.uuid(),
    username: z.string(),
    displayName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    avatarUrl: z.string().max(512).nullable(),
    status: z.enum(['INVITED', 'ACTIVE', 'DISABLED', 'LOCKED']),
    lastLoginAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    passwordChangedAt: z.iso.datetime(),
  })
  .meta({ id: 'IamAccountProfile' })

export const updateAccountInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160).optional(),
    avatarUrl: z.string().max(512).nullable().optional(),
  })
  .meta({ id: 'IamUpdateAccountInput' })

export const changePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(1).max(1_024),
    newPassword: z.string().min(8).max(1_024),
  })
  .meta({ id: 'IamChangePasswordInput' })

export const accountRoleSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    status: z.enum(['INVITED', 'ACTIVE', 'DISABLED', 'LOCKED']),
  })
  .meta({ id: 'IamAccountRole' })

export const accountRolesSchema = z
  .object({
    roles: z.array(accountRoleSchema),
  })
  .meta({ id: 'IamAccountRoles' })

export const roleStatuses = ['ACTIVE', 'DISABLED'] as const
export type RoleStatus = (typeof roleStatuses)[number]

export const roleDataScopeTypes = [
  'ALL',
  'ORGANIZATION',
  'ORGANIZATION_AND_DESCENDANTS',
  'SELF',
  'CUSTOM',
] as const
export type RoleDataScopeType = (typeof roleDataScopeTypes)[number]

export const iamRoleCodeSchema = z.string().trim().min(1).max(120)
export const iamRoleNameSchema = z.string().trim().min(1).max(160)
export const iamPermissionCodeSchema = z.string().trim().min(1).max(160)

export const iamRoleSchema = z
  .object({
    id: z.uuid(),
    code: iamRoleCodeSchema,
    name: iamRoleNameSchema,
    description: z.string().nullable(),
    status: z.enum(roleStatuses),
    isSystem: z.boolean(),
    assignmentCount: z.number().int().min(0),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .meta({ id: 'IamRole' })

export const iamRoleListSchema = z
  .object({
    roles: z.array(iamRoleSchema).max(1_000),
  })
  .meta({ id: 'IamRoleList' })

export const iamRoleRefSchema = z.object({ id: z.uuid() }).strict().meta({ id: 'IamRoleRef' })

export const createIamRoleSchema = z
  .object({
    code: iamRoleCodeSchema,
    name: iamRoleNameSchema,
    description: z.string().trim().max(2_000).nullish(),
    status: z.enum(roleStatuses).optional(),
  })
  .strict()
  .meta({ id: 'IamCreateRoleInput' })

export const updateIamRoleSchema = z
  .object({
    name: iamRoleNameSchema.optional(),
    description: z.string().trim().max(2_000).nullable().optional(),
    status: z.enum(roleStatuses).optional(),
  })
  .strict()
  .meta({ id: 'IamUpdateRoleInput' })

export const rolePermissionGrantSchema = z
  .object({
    permissionCode: iamPermissionCodeSchema,
    scopeType: z.enum(roleDataScopeTypes),
  })
  .strict()
  .meta({ id: 'IamRolePermissionGrant' })

export const rolePermissionGrantViewSchema = z
  .object({
    permissionCode: iamPermissionCodeSchema,
    moduleId: z.string().min(1).max(80),
    name: z.string(),
    supportsDataScope: z.boolean(),
    scopeType: z.enum(roleDataScopeTypes),
  })
  .strict()
  .meta({ id: 'IamRolePermissionGrantView' })

export const rolePermissionListSchema = z
  .object({
    permissions: z.array(rolePermissionGrantViewSchema).max(2_000),
  })
  .meta({ id: 'IamRolePermissionList' })

export const replaceRolePermissionsSchema = z
  .object({
    permissions: z.array(rolePermissionGrantSchema).max(2_000),
  })
  .strict()
  .meta({ id: 'IamReplaceRolePermissionsInput' })

export const permissionCatalogItemSchema = z
  .object({
    code: iamPermissionCodeSchema,
    moduleId: z.string().min(1).max(80),
    name: z.string(),
    supportsDataScope: z.boolean(),
  })
  .strict()
  .meta({ id: 'IamPermissionCatalogItem' })

export const permissionCatalogSchema = z
  .object({
    permissions: z.array(permissionCatalogItemSchema).max(5_000),
  })
  .meta({ id: 'IamPermissionCatalog' })

export const managedUserSchema = z
  .object({
    id: z.uuid(),
    username: z.string(),
    displayName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    status: z.enum(['INVITED', 'ACTIVE', 'DISABLED', 'LOCKED']),
    lastLoginAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    roleCount: z.number().int().min(0),
  })
  .strict()
  .meta({ id: 'IamManagedUser' })

export const managedUserListSchema = z
  .object({
    users: z.array(managedUserSchema).max(2_000),
  })
  .meta({ id: 'IamManagedUserList' })

export const managedUserRefSchema = z
  .object({ id: z.uuid() })
  .strict()
  .meta({ id: 'IamManagedUserRef' })

export const createManagedUserSchema = z
  .object({
    username: z.string().trim().min(1).max(120),
    displayName: z.string().trim().min(1).max(160),
    email: z.email().max(320).nullish(),
    phone: z.string().trim().max(40).nullish(),
    password: z.string().min(8).max(1_024),
    roleIds: z.array(z.uuid()).max(100).optional(),
  })
  .strict()
  .meta({ id: 'IamCreateManagedUserInput' })

export const updateManagedUserSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160).optional(),
    email: z.email().max(320).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  })
  .strict()
  .meta({ id: 'IamUpdateManagedUserInput' })

export const resetManagedUserPasswordSchema = z
  .object({
    newPassword: z.string().min(8).max(1_024),
  })
  .strict()
  .meta({ id: 'IamResetManagedUserPasswordInput' })

export const replaceUserRolesSchema = z
  .object({
    roleIds: z.array(z.uuid()).max(100),
  })
  .strict()
  .meta({ id: 'IamReplaceUserRolesInput' })

export const userRoleAssignmentSchema = z
  .object({
    id: z.uuid(),
    code: z.string(),
    name: z.string(),
    status: z.enum(roleStatuses),
  })
  .strict()
  .meta({ id: 'IamUserRoleAssignment' })

export const userRoleListSchema = z
  .object({
    roles: z.array(userRoleAssignmentSchema).max(200),
  })
  .meta({ id: 'IamUserRoleList' })

export type LoginInput = z.infer<typeof loginInputSchema>
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>
export type LoginResult = z.infer<typeof loginResultSchema>
export type RefreshSessionResult = z.infer<typeof refreshSessionResultSchema>
export type SessionStatus = z.infer<typeof sessionStatusSchema>
export type AccountProfile = z.infer<typeof accountProfileSchema>
export type UpdateAccountInput = z.infer<typeof updateAccountInputSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>
export type AccountRole = z.infer<typeof accountRoleSchema>
export type AccountRoles = z.infer<typeof accountRolesSchema>
export type IamRole = z.infer<typeof iamRoleSchema>
export type CreateIamRole = z.infer<typeof createIamRoleSchema>
export type UpdateIamRole = z.infer<typeof updateIamRoleSchema>
export type RolePermissionGrant = z.infer<typeof rolePermissionGrantSchema>
export type RolePermissionGrantView = z.infer<typeof rolePermissionGrantViewSchema>
export type RolePermissionList = z.infer<typeof rolePermissionListSchema>
export type ReplaceRolePermissions = z.infer<typeof replaceRolePermissionsSchema>
export type PermissionCatalogItem = z.infer<typeof permissionCatalogItemSchema>
export type PermissionCatalog = z.infer<typeof permissionCatalogSchema>
export type ManagedUser = z.infer<typeof managedUserSchema>
export type CreateManagedUser = z.infer<typeof createManagedUserSchema>
export type UpdateManagedUser = z.infer<typeof updateManagedUserSchema>
export type ResetManagedUserPassword = z.infer<typeof resetManagedUserPasswordSchema>
export type ReplaceUserRoles = z.infer<typeof replaceUserRolesSchema>
export type UserRoleAssignment = z.infer<typeof userRoleAssignmentSchema>
export type UserRoleList = z.infer<typeof userRoleListSchema>
