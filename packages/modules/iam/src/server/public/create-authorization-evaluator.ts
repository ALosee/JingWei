import type { DatabaseRuntime } from '@jingwei/database'
import type { ModuleRegistry } from '@jingwei/module-sdk'
import type { AppLogger } from '@jingwei/observability'

import { PostgresAuthorizationEvaluator } from '../infrastructure/authorization-evaluator.pg.js'
import type { AuthorizationEvaluator, OrganizationalScopeFacts } from './authorization.js'

/**
 * Explicit factory. Callers inject organizational facts; IAM never imports their implementation.
 */
export function createAuthorizationEvaluator(
  database: DatabaseRuntime,
  registry: ModuleRegistry,
  facts: OrganizationalScopeFacts,
  logger?: AppLogger,
): AuthorizationEvaluator {
  return new PostgresAuthorizationEvaluator(database.view(), registry, facts, logger)
}
