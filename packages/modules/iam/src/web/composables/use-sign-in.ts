import { ref } from 'vue'

import { login } from '../../client/index.js'

/** Owns sign-in form submission; the page renders fields and binds actions. */
export function useSignIn(
  dependencies = { login, enterWorkspace: () => window.location.assign('/') },
) {
  const tenantCode = ref('default')
  const username = ref('')
  const password = ref('')
  const errorMessage = ref('')
  const submitting = ref(false)

  async function submit(): Promise<void> {
    submitting.value = true
    errorMessage.value = ''
    try {
      await dependencies.login({
        tenantCode: tenantCode.value,
        login: username.value,
        password: password.value,
      })
      dependencies.enterWorkspace()
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '登录失败'
    } finally {
      submitting.value = false
    }
  }
  return { tenantCode, username, password, errorMessage, submitting, submit }
}
