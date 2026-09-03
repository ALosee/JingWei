import type { DictionaryItemSnapshot } from '../../shared/index.js'

/**
 * Cross-module read port for tenant dictionary items.
 * Implementations must include tenant scope and stable ordering; consumers must not query the
 * Dictionary schema or rely on mutable labels as business identifiers.
 */
export interface DictionaryQuery {
  findItems(tenantId: string, dictionaryCode: string): Promise<readonly DictionaryItemSnapshot[]>
}
