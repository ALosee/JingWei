import type { RequestId, SessionId, TenantId, UserId } from './ids.js'

/**
 * Trusted identity and correlation data for one application operation.
 *
 * The protocol/task boundary creates this value after resolving a tenant and user. Do not use
 * placeholder identities for anonymous requests, and do not recover tenant/user ids again from
 * global state inside a use case.
 */
export interface ApplicationContext {
  readonly requestId: RequestId
  readonly tenantId: TenantId
  readonly userId: UserId
}

/** Authenticated HTTP context, including the revocable session and projected role ids. */
export interface AuthContext extends ApplicationContext {
  readonly sessionId: SessionId
  readonly roleIds: readonly string[]
}
