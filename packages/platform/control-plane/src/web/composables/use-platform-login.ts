import { ref } from 'vue'

import { useApiRequestState } from '@jingwei/api-client/vue'

import { loginPlatformOperator } from '../../client/index.js'
import { safePlatformRedirect } from '../platform-redirect.js'
import { setPlatformOperator } from '../state.js'

export function usePlatformLogin() {
  const login = ref('')
  const password = ref('')
  const errorMessage = ref('')
  const requestState = useApiRequestState()

  async function submit(): Promise<void> {
    errorMessage.value = ''
    if (login.value.trim().length === 0 || password.value.length === 0) {
      errorMessage.value = '请输入平台管理员账号和密码'
      return
    }
    const result = await loginPlatformOperator(
      { login: login.value.trim(), password: password.value },
      requestState.options,
    )
    if (result.error !== null) {
      errorMessage.value = result.error.message
      return
    }
    setPlatformOperator(result.data.operator)
    const redirect = safePlatformRedirect(
      new URLSearchParams(window.location.search).get('redirect'),
      window.location.origin,
    )
    window.location.assign(redirect)
  }

  return { login, password, errorMessage, submitting: requestState.loading, submit }
}
