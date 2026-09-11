import * as authSession from './20260901000200_platform_auth_session.js'
import * as authDualToken from './20260910090000_platform_auth_dual_token.js'

export const migrations = {
  '20260901000200_platform_auth_session': authSession,
  '20260910090000_platform_auth_dual_token': authDualToken,
} as const
