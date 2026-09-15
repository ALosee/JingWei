import type { AuthContext } from '@jingwei/kernel'

import type { SessionStatus } from '../../shared/index.js'
import type { CurrentUserReader } from './read-current-user.js'

/** Live session projection for the application shell: user identity plus effective permission codes. */
export class ReadSessionStatus {
  constructor(
    private readonly users: CurrentUserReader,
    private readonly permissions: {
      effectivePermissionCodes(context: AuthContext): Promise<readonly string[]>
    },
  ) {}

  async execute(context: AuthContext): Promise<SessionStatus> {
    const user = await this.users.findActiveById(context.tenantId, context.userId)
    if (user === null) return { authenticated: false }
    const permissions = await this.permissions.effectivePermissionCodes(context)
    return {
      authenticated: true,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      permissions: [...permissions],
    }
  }
}
