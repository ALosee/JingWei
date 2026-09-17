import { ApplicationError, type AuthContext } from '@jingwei/kernel'
import type { AppLogger } from '@jingwei/observability'

const slowAuthorizationThresholdMs = 50

export type AuthorizationEvaluatorKind = 'UNSCOPED' | 'SCOPED'

/** Records decision latency without caching identity or policy state. */
export async function observeAuthorization<T>(options: {
  readonly logger?: AppLogger | undefined
  readonly context: AuthContext
  readonly permission: string
  readonly evaluator: AuthorizationEvaluatorKind
  readonly evaluate: () => Promise<T>
}): Promise<T> {
  const startedAt = performance.now()
  let outcome: 'ALLOWED' | 'DENIED' | 'FAILED' = 'FAILED'
  try {
    const result = await options.evaluate()
    outcome = 'ALLOWED'
    return result
  } catch (error) {
    if (error instanceof ApplicationError && error.code === 'PERMISSION_DENIED') outcome = 'DENIED'
    throw error
  } finally {
    if (options.logger !== undefined) {
      const durationMs = Math.round((performance.now() - startedAt) * 100) / 100
      const fields = {
        requestId: options.context.requestId,
        tenantId: options.context.tenantId,
        userId: options.context.userId,
        module: 'iam',
        action: 'authorization.evaluate',
        permission: options.permission,
        evaluator: options.evaluator,
        outcome,
        durationMs,
      }
      if (outcome === 'FAILED' || durationMs >= slowAuthorizationThresholdMs) {
        options.logger.warn(fields, 'iam.authorization.evaluated')
      } else {
        options.logger.debug(fields, 'iam.authorization.evaluated')
      }
    }
  }
}
