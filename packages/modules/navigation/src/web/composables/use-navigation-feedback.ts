import { ref } from 'vue'
import { ApiClientError } from '@jingwei/api-client'
import { validationResultSchema } from '../../shared/index.js'

/** Feedback belongs to this editor: preserve safe validation issues and prevent concurrent UI mutations. */
export function useNavigationFeedback() {
  const busy = ref(false)
  const message = ref('')
  const error = ref('')
  async function run(action: () => Promise<void>) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    message.value = ''
    try { await action() }
    catch (cause) {
      error.value = cause instanceof Error ? cause.message : '操作失败'
      if (cause instanceof ApiClientError) {
        const details = validationResultSchema.safeParse(cause.details)
        if (details.success) error.value += '\n' + details.data.issues.map((issue) => issue.message + ' [' + issue.code + ']').join('\n')
        if (cause.requestId) error.value += '\nrequestId: ' + cause.requestId
      }
    } finally { busy.value = false }
  }
  return { busy, message, error, run }
}
export type NavigationFeedback = ReturnType<typeof useNavigationFeedback>
