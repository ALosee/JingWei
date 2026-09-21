import { getPlatformSessionStatus } from '../client/index.js'
import { setPlatformOperator } from './state.js'

/** Restore the control-plane identity without exposing its client workflow to the app composition root. */
export async function initializePlatformSession(): Promise<boolean> {
  const session = await getPlatformSessionStatus().catch(() => ({ authenticated: false }) as const)
  setPlatformOperator(session.authenticated ? session.operator : null)
  return session.authenticated
}
