import { ref } from 'vue'

import { ApiClientError } from '@jingwei/api-client'

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiClientError) {
    const requestId = cause.requestId === null ? '' : `\nrequestId: ${cause.requestId}`
    return cause.message + requestId
  }
  return cause instanceof Error ? cause.message : '操作失败'
}

export function useDictionaryFeedback() {
  const busy = ref(false)
  const error = ref('')

  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (busy.value) return undefined
    busy.value = true
    error.value = ''
    try {
      return await action()
    } catch (cause) {
      error.value = errorMessage(cause)
      return undefined
    } finally {
      busy.value = false
    }
  }

  function fail(cause: unknown) {
    error.value = errorMessage(cause)
  }

  return { busy, error, run, fail }
}
