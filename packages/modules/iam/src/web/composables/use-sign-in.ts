import { ref } from 'vue'

import type { ApiRequestOptions } from '@jingwei/api-client'
import { useApiRequestState } from '@jingwei/api-client/vue'

import { login } from '../../client/index.js'
import type { LoginInput } from '../../shared/index.js'

interface SignInDependencies {
  login: (input: LoginInput, options: ApiRequestOptions) => Promise<{ error: Error | null }>
  enterWorkspace: () => void
}

/** Owns sign-in form submission; the page renders fields and binds actions. */
export function useSignIn(
  dependencies: SignInDependencies = {
    login,
    enterWorkspace: () => window.location.assign('/'),
  },
) {
  const tenantCode = ref('default')
  const username = ref('')
  const password = ref('')
  const errorMessage = ref('')
  const requestState = useApiRequestState()

  async function submit(): Promise<void> {
    if (requestState.loading.value) return
    errorMessage.value = ''
    const { error } = await dependencies.login(
      {
        tenantCode: tenantCode.value,
        login: username.value,
        password: password.value,
      },
      requestState.options,
    )
    if (error !== null) {
      errorMessage.value = error.message
      return
    }

    dependencies.enterWorkspace()
  }

  return {
    tenantCode,
    username,
    password,
    errorMessage,
    submitting: requestState.loading,
    submit,
  }
}
