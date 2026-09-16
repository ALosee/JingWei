import type { DatabaseRuntime } from '@jingwei/database'
import { toTenantId } from '@jingwei/kernel'

import type { DictionarySnapshot } from '../../shared/index.js'
import {
  PostgresDictionaryStore,
  type DictionaryDatabase,
} from '../infrastructure/dictionary-store.pg.js'
import type { DictionaryQuery } from './index.js'

export function createDictionaryQuery(database: DatabaseRuntime): DictionaryQuery {
  const store = new PostgresDictionaryStore(database.view<DictionaryDatabase>())

  async function getSnapshot(
    tenantIdValue: string,
    dictionaryCode: string,
  ): Promise<DictionarySnapshot | null> {
    const tenantId = toTenantId(tenantIdValue)
    const type = await store.typeByCode(tenantId, dictionaryCode)
    if (type === null) return null
    const items = await store.listItems(tenantId, type.id)
    return {
      code: type.code,
      name: type.name,
      enabled: type.status === 'ENABLED',
      revision: type.revision,
      items: items.map((item) => ({
        code: item.code,
        label: item.label,
        enabled: item.status === 'ENABLED',
      })),
    }
  }

  return {
    getSnapshot,
    async resolveItems(tenantId, dictionaryCode, itemCodes) {
      const snapshot = await getSnapshot(tenantId, dictionaryCode)
      if (snapshot === null || itemCodes.length === 0) return []
      const byCode = new Map(snapshot.items.map((item) => [item.code, item]))
      return itemCodes.flatMap((code) => {
        const item = byCode.get(code)
        return item === undefined ? [] : [item]
      })
    },
  }
}
