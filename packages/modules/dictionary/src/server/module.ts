import { createIamAccess } from '@jingwei/module-iam/server/public'
import type { ServerModule } from '@jingwei/module-sdk/server'

import { manifest } from '../manifest.js'
import { createDictionaryRoutes } from './api/routes.js'
import { ManageDictionary } from './application/manage-dictionary.js'
import {
  PostgresDictionaryStore,
  PostgresDictionaryUnitOfWork,
  type DictionaryDatabase,
} from './infrastructure/dictionary-store.pg.js'

export const serverModule: ServerModule = {
  manifest,
  install(context) {
    const database = context.database.view<DictionaryDatabase>()
    const manage = new ManageDictionary(
      new PostgresDictionaryStore(database),
      new PostgresDictionaryUnitOfWork(database),
      createIamAccess(context.database, context.moduleRegistry, context.logger),
    )
    return Promise.resolve({
      id: manifest.id,
      basePath: '/dictionary',
      routes: createDictionaryRoutes(manage),
    })
  },
}
