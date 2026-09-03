import type { Runtime } from '../bootstrap/runtime.js'
import { correlateRequest } from './request-id.js'
import { sessionSecurity } from './session-security.js'
import { requestLogging } from './request-logging.js'

/** Explicit order is a security contract: correlation -> Origin/session/CSRF -> access logging. */
export function requestContextMiddleware(runtime: Runtime) {
  return [
    correlateRequest(),
    sessionSecurity({ sessions: runtime.sessionService, appOrigin: runtime.config.appOrigin }),
    requestLogging(runtime.logger),
  ] as const
}
