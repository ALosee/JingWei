import * as iamFoundation from './20260901010100_iam_foundation.js'
import * as permissionDataScopeMetadata from './20260916090000_iam_permission_data_scope_metadata.js'

export const migrations = {
  '20260901010100_iam_foundation': iamFoundation,
  '20260916090000_iam_permission_data_scope_metadata': permissionDataScopeMetadata,
} as const
