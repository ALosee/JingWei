import * as dictionaryFoundation from './20260901030100_dictionary_foundation.js'
import * as dictionaryCatalog from './20260916090000_dictionary_catalog.js'

export const migrations = {
  '20260901030100_dictionary_foundation': dictionaryFoundation,
  '20260916090000_dictionary_catalog': dictionaryCatalog,
} as const
