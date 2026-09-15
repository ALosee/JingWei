import type { WebModule } from '@jingwei/module-sdk/web'

import { manifest } from '../manifest.js'

export const webModule: WebModule = {
  manifest,
  pages: [
    { routeKey: 'iam.login', pageKey: 'IamLogin' },
    { routeKey: 'iam.account', pageKey: 'IamAccount' },
    { routeKey: 'iam.roles', pageKey: 'IamRoles' },
    { routeKey: 'iam.users', pageKey: 'IamUsers' },
  ],
}
