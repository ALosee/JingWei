import { ref, watch, type Ref } from 'vue'

import * as api from '../../client/index.js'
import type {
  CreateDictionaryItem,
  DictionaryTypeDetail,
  UpdateDictionaryItem,
} from '../../shared/index.js'
import type { useDictionaryFeedback } from './use-dictionary-feedback.js'

type DictionaryFeedback = ReturnType<typeof useDictionaryFeedback>

/**
 * Caches type details so category → type switches remount instantly.
 * Stale in-flight responses are dropped by sequence.
 */
export function useDictionaryItems(
  selectedTypeId: Ref<string>,
  feedback: DictionaryFeedback,
  adopt: (detail: DictionaryTypeDetail) => void,
) {
  const detail = ref<DictionaryTypeDetail | null>(null)
  const loadedFor = ref('')
  const loadingDetail = ref(false)
  const cache = new Map<string, DictionaryTypeDetail>()
  const inflight = new Map<string, Promise<DictionaryTypeDetail | null>>()
  let loadSequence = 0

  function adoptDetail(next: DictionaryTypeDetail) {
    cache.set(next.type.id, next)
    detail.value = next
    loadedFor.value = next.type.id
    adopt(next)
  }

  /** Single-flight fetch: concurrent prefetch/load for the same type share one HTTP request. */
  async function fetchDetail(id: string): Promise<DictionaryTypeDetail | null> {
    const cached = cache.get(id)
    if (cached !== undefined) return cached
    const existing = inflight.get(id)
    if (existing !== undefined) return existing

    const request = (async () => {
      try {
        const result = await api.getDictionaryType(id)
        if (result.error !== null) {
          feedback.fail(result.error)
          return null
        }
        cache.set(result.data.type.id, result.data)
        return result.data
      } finally {
        inflight.delete(id)
      }
    })()
    inflight.set(id, request)
    return request
  }

  /** Warm the cache before the user clicks a type under the selected category. */
  async function prefetch(ids: readonly string[]) {
    const pending = ids.filter((id) => id !== '' && !cache.has(id))
    if (pending.length === 0) return
    await Promise.all(
      pending.map(async (id) => {
        const data = await fetchDetail(id)
        if (data !== null && selectedTypeId.value === id && loadedFor.value !== id)
          adoptDetail(data)
      }),
    )
  }

  async function load(id = selectedTypeId.value) {
    // Selecting a category clears selectedTypeId; keep the cache so returning is instant.
    if (id === '') {
      loadingDetail.value = false
      return
    }
    if (loadedFor.value === id && detail.value?.type.id === id) return

    const cached = cache.get(id)
    if (cached !== undefined) {
      adoptDetail(cached)
      return
    }

    const sequence = ++loadSequence
    loadingDetail.value = true
    try {
      const data = await fetchDetail(id)
      if (sequence !== loadSequence) return
      if (data === null) return
      if (selectedTypeId.value === id) adoptDetail(data)
    } catch (cause) {
      if (sequence === loadSequence) feedback.fail(cause)
    } finally {
      if (sequence === loadSequence) loadingDetail.value = false
    }
  }

  async function createItem(input: CreateDictionaryItem) {
    const typeId = selectedTypeId.value
    if (typeId === '') return undefined
    return feedback.run(async () => {
      const result = await api.createDictionaryItem(typeId, input)
      if (result.error !== null) throw result.error
      adoptDetail(result.data)
      return result.data
    })
  }

  async function updateItem(itemId: string, input: UpdateDictionaryItem) {
    const typeId = selectedTypeId.value
    if (typeId === '') return undefined
    return feedback.run(async () => {
      const result = await api.updateDictionaryItem(typeId, itemId, input)
      if (result.error !== null) throw result.error
      adoptDetail(result.data)
      return result.data
    })
  }

  watch(selectedTypeId, (id) => {
    void load(id)
  })

  return { detail, loadingDetail, load, prefetch, adoptDetail, createItem, updateItem }
}
