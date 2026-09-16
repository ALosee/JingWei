import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

import * as api from '../../client/index.js'
import type { DictionaryItemSnapshot } from '../../shared/index.js'

export interface DictionaryOption {
  readonly value: string
  readonly label: string
}

export interface DictionaryOptionsState {
  readonly options: ComputedRef<DictionaryOption[]>
  readonly items: Ref<DictionaryItemSnapshot[]>
  readonly loading: Ref<boolean>
  readonly error: Ref<string>
  readonly reload: () => Promise<void>
}

/**
 * Form-facing options for a tenant dictionary type code.
 * Stores only the stable item `code`; labels are display-only and may change.
 * Requires `dictionary.view` on the management API. Restricted business users
 * should receive options from their own module API wrapping DictionaryQuery.
 */
export function useDictionaryOptions(
  dictionaryCode: Ref<string> | string,
  options?: { includeDisabled?: boolean },
): DictionaryOptionsState {
  const codeRef = typeof dictionaryCode === 'string' ? ref(dictionaryCode) : dictionaryCode
  const includeDisabled = options?.includeDisabled ?? false
  const items = ref<DictionaryItemSnapshot[]>([])
  const loading = ref(false)
  const error = ref('')
  let sequence = 0

  const optionsList = computed(() =>
    items.value
      .filter((item) => includeDisabled || item.enabled)
      .map((item) => ({ value: item.code, label: item.label })),
  )

  async function reload() {
    const code = codeRef.value.trim()
    if (code === '') {
      items.value = []
      error.value = ''
      return
    }
    const current = ++sequence
    loading.value = true
    error.value = ''
    try {
      const result = await api.getDictionaryTypeByCode(code)
      if (current !== sequence) return
      if (result.error !== null) {
        error.value = result.error.message
        items.value = []
        return
      }
      items.value = result.data.items.map((item) => ({
        code: item.code,
        label: item.label,
        enabled: item.status === 'ENABLED',
      }))
    } catch (cause) {
      if (current === sequence)
        error.value = cause instanceof Error ? cause.message : '加载字典失败'
    } finally {
      if (current === sequence) loading.value = false
    }
  }

  watch(codeRef, () => {
    void reload()
  })
  void reload()

  return { options: optionsList, items, loading, error, reload }
}
