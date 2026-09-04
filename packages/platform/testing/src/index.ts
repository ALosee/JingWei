import {
  newRequestId,
  newTenantId,
  newUserId,
  type ApplicationContext,
  type Clock,
} from '@jingwei/kernel'

export function createTestContext(overrides: Partial<ApplicationContext> = {}): ApplicationContext {
  return {
    requestId: overrides.requestId ?? newRequestId(),
    tenantId: overrides.tenantId ?? newTenantId(),
    userId: overrides.userId ?? newUserId(),
  }
}

export function fixedClock(value = '2026-09-01T00:00:00.000Z'): Clock {
  const now = new Date(value)
  return { now: () => new Date(now) }
}
