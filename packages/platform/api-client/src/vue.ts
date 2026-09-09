import { computed, readonly, ref, type ComputedRef, type DeepReadonly, type Ref } from 'vue'

import { subscribeGlobalApiLoading, type ApiRequestOptions } from './index.js'

const globalLoading = ref(false)
subscribeGlobalApiLoading((loading) => {
  globalLoading.value = loading
})

export interface ApiRequestState {
  /** True while at least one request using `options` is in flight. */
  readonly loading: ComputedRef<boolean>
  /** Pass these options to a module client operation; Soybean Fetch owns the transitions. */
  readonly options: ApiRequestOptions
}

/** Bridges Soybean Fetch lifecycle callbacks to concurrency-safe Vue request state. */
export function useApiRequestState(): ApiRequestState {
  const pendingCount = ref(0)

  return {
    loading: computed(() => pendingCount.value > 0),
    options: {
      onLoadingChange(loading) {
        pendingCount.value = Math.max(0, pendingCount.value + (loading ? 1 : -1))
      },
    },
  }
}

/** Aggregate loading state for the shared HTTP instance, suitable for an application progress bar. */
export function useGlobalApiLoading(): DeepReadonly<Ref<boolean>> {
  return readonly(globalLoading)
}
