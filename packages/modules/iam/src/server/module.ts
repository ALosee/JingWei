import { PostgresAuditWriter } from '@jingwei/audit'
import { Argon2idPasswordHasher } from '@jingwei/auth'
import { systemClock } from '@jingwei/kernel'
import type { ServerModule } from '@jingwei/module-sdk/server'

import { manifest } from '../manifest.js'
import { createIamRoutes } from './api/routes.js'
import { AuthenticateUser } from './application/authenticate-user.js'
import { ReadCurrentUser } from './application/read-current-user.js'
import { SessionLifecycle } from './application/session-lifecycle.js'
import { PostgresCredentialStore, type IamDatabase } from './infrastructure/credential-reader.pg.js'
import { PostgresCurrentUserReader } from './infrastructure/current-user-reader.pg.js'

export const serverModule: ServerModule = {
  manifest,
  async install(context) {
    const credentials = new PostgresCredentialStore(context.database.view<IamDatabase>())
    const currentUsers = new PostgresCurrentUserReader(context.database.view<IamDatabase>())
    const passwords = new Argon2idPasswordHasher()
    const dummyPasswordHash = await passwords.hash('not-a-real-jingwei-user-password')
    const audit = new PostgresAuditWriter(context.database.view())
    const authenticateUser = new AuthenticateUser({
      tenants: context.tenantDirectory,
      credentials,
      unitOfWork: credentials,
      passwords,
      sessions: context.sessionService,
      clock: systemClock,
      dummyPasswordHash,
      policy: context.config.login,
    })
    const sessionLifecycle = new SessionLifecycle({ sessions: context.sessionService, audit })

    return {
      id: manifest.id,
      basePath: '/iam',
      routes: createIamRoutes({
        authenticateUser,
        readCurrentUser: new ReadCurrentUser(currentUsers),
        sessions: sessionLifecycle,
        secureCookies: context.config.environment === 'production',
        logger: context.logger,
      }),
    }
  },
}
