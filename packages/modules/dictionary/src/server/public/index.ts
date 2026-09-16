import type { DictionaryItemSnapshot, DictionarySnapshot } from '../../shared/index.js'

/**
 * Cross-module read port for tenant dictionary items.
 * Implementations must include tenant scope and stable ordering; consumers must not query the
 * Dictionary schema or rely on mutable labels as business identifiers.
 */
export interface DictionaryQuery {
  getSnapshot(tenantId: string, dictionaryCode: string): Promise<DictionarySnapshot | null>
  /** Resolves current labels for stored codes, including disabled historical items. */
  resolveItems(
    tenantId: string,
    dictionaryCode: string,
    itemCodes: readonly string[],
  ): Promise<readonly DictionaryItemSnapshot[]>
}

export { createDictionaryManagement } from './create-management.js'
export { createDictionaryQuery } from './create-query.js'
export type { ManageDictionary } from '../application/manage-dictionary.js'
