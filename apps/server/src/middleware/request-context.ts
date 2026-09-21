import type { Runtime } from '../bootstrap/runtime.js'
import { platformSessionSecurity } from './platform-session-security.js'
import { correlateRequest } from './request-id.js'
import { requestLogging } from './request-logging.js'
import { requestMetadata } from './request-metadata.js'
import { sessionSecurity } from './session-security.js'

/** Security order: correlation -> request metadata -> Origin/session/CSRF -> access logging. */
export function requestContextMiddleware(runtime: Runtime) {
  return [
    correlateRequest(),
    requestMetadata({ trustProxy: runtime.config.http.trustProxy }),
    platformSessionSecurity({
      sessions: runtime.operatorSessionService,
      appOrigin: runtime.config.appOrigin,
    }),
    sessionSecurity({ sessions: runtime.sessionService, appOrigin: runtime.config.appOrigin }),
    requestLogging(runtime.logger),
  ] as const
}
