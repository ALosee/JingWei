import type { AuditWriter } from '@jingwei/audit'
import type { SessionService } from '@jingwei/auth'
import type { AuthContext, RequestId } from '@jingwei/kernel'

/** Coordinates refresh/logout security side effects outside the HTTP transport boundary. */
export class SessionLifecycle {
  constructor(
    private readonly dependencies: {
      readonly sessions: Pick<SessionService, 'refresh' | 'revoke'>
      readonly audit: Pick<AuditWriter, 'append'>
    },
  ) {}

  async refresh(input: {
    readonly requestId: RequestId
    readonly refreshToken: string
    readonly csrfCookieToken: string | undefined
    readonly csrfHeaderToken: string | undefined
  }) {
    const result = await this.dependencies.sessions.refresh(input)
    if (result.status !== 'reused') return result

    await this.dependencies.audit.append({
      context: {
        requestId: input.requestId,
        tenantId: result.session.tenantId,
        userId: result.session.userId,
      },
      module: 'iam',
      action: 'authentication.refresh-token-reuse',
      entityType: 'AUTH_SESSION',
      entityId: result.session.id,
      result: 'FAILURE',
    })
    return result
  }

  async logout(context: AuthContext): Promise<void> {
    await this.dependencies.sessions.revoke(context.sessionId)
    await this.dependencies.audit.append({
      context,
      module: 'iam',
      action: 'authentication.logout',
      entityType: 'AUTH_SESSION',
      entityId: context.sessionId,
      result: 'SUCCESS',
    })
  }
}
