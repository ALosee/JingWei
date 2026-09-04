import { Argon2idPasswordHasher } from '@jingwei/auth'
import type { ServerModule } from '@jingwei/module-sdk/server'

import { manifest } from '../manifest.js'
import { createIamRoutes } from './api/routes.js'
import { AuthenticateUser } from './application/authenticate-user.js'
import {
  PostgresCredentialReader,
  type IamDatabase,
} from './infrastructure/credential-reader.pg.js'

export const serverModule: ServerModule = {
  manifest,
  install(context) {
    const credentials = new PostgresCredentialReader(context.database.view<IamDatabase>())
    const authenticateUser = new AuthenticateUser({
      tenants: context.tenantDirectory,
      credentials,
      passwords: new Argon2idPasswordHasher(),
      sessions: context.sessionService,
    })

    return Promise.resolve({
      id: manifest.id,
      basePath: '/iam',
      routes: createIamRoutes({
        authenticateUser,
        sessions: context.sessionService,
        secureCookies: context.config.environment === 'production',
      }),
    })
  },
}
