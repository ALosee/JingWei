import type { DatabaseRuntime } from '@jingwei/database'
import type { ModuleRegistry } from '@jingwei/module-sdk'

import { PostgresAuthorizationEvaluator } from '../infrastructure/authorization-evaluator.pg.js'
import type { AuthorizationEvaluator, OrganizationalScopeFacts } from './authorization.js'

/**
 * Explicit factory. Callers inject organizational facts; IAM never imports their implementation.
 */
export function createAuthorizationEvaluator(
  database: DatabaseRuntime,
  registry: ModuleRegistry,
  facts: OrganizationalScopeFacts,
): AuthorizationEvaluator {
  return new PostgresAuthorizationEvaluator(database.view(), registry, facts)
}
