import { ref, watch } from 'vue'

import type { ApiRequestOptions } from '@jingwei/api-client'
import { useApiRequestState } from '@jingwei/api-client/vue'

import { login } from '../../client/index.js'
import type { LoginInput } from '../../shared/index.js'
import { currentTenantLoginHint, rememberSuccessfulTenantCode } from '../tenant-login-hint.js'

interface SignInDependencies {
  login: (input: LoginInput, options: ApiRequestOptions) => Promise<{ error: Error | null }>
  enterWorkspace: () => void
  initialTenantCode: () => string
  rememberTenantCode: (tenantCode: string) => void
}

function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/'
  if (value.startsWith('/__')) return '/'
  return value
}

/** Owns sign-in form submission; the page renders fields and binds actions. */
export function useSignIn(overrides: Partial<SignInDependencies> = {}) {
  const dependencies: SignInDependencies = {
    login,
    enterWorkspace: () => {
      const redirect = safeReturnPath(new URLSearchParams(window.location.search).get('redirect'))
      window.location.assign(redirect)
    },
    initialTenantCode: currentTenantLoginHint,
    rememberTenantCode: rememberSuccessfulTenantCode,
    ...overrides,
  }
  const tenantCode = ref(dependencies.initialTenantCode())
  const username = ref('')
  const password = ref('')
  const errorMessage = ref('')
  const requestState = useApiRequestState()

  watch([tenantCode, username, password], () => {
    errorMessage.value = ''
  })

  async function submit(): Promise<void> {
    if (requestState.loading.value) return
    errorMessage.value = ''
    const input = {
      tenantCode: tenantCode.value.trim(),
      login: username.value.trim(),
      password: password.value,
    }
    if (input.tenantCode.length === 0 || input.login.length === 0 || input.password.length === 0) {
      errorMessage.value = '请完整填写租户代码、账号和密码'
      return
    }
    const { error } = await dependencies.login(input, requestState.options)
    if (error !== null) {
      errorMessage.value = error.message
      return
    }

    dependencies.rememberTenantCode(input.tenantCode)
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
