import * as auditLog from './20260901000300_platform_audit_log.js'
import * as operatorAudit from './20260920100000_platform_operator_audit.js'
import * as globalScope from './20260921100000_platform_audit_global_scope.js'

export const migrations = {
  '20260901000300_platform_audit_log': auditLog,
  '20260920100000_platform_operator_audit': operatorAudit,
  '20260921100000_platform_audit_global_scope': globalScope,
} as const
