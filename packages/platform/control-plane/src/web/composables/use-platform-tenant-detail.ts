import { reactive, ref } from 'vue'

import { useApiRequestState } from '@jingwei/api-client/vue'

import {
  getPlatformTenant,
  retryPlatformTenant,
  transitionPlatformTenant,
} from '../../client/index.js'
import type { PlatformTenant, RetryPlatformTenant } from '../../shared/index.js'

type RetryTenantForm = Omit<RetryPlatformTenant, 'adminEmail'> & { adminEmail: string }

export function usePlatformTenantDetail(tenantId: string) {
  const tenant = ref<PlatformTenant | null>(null)
  const errorMessage = ref('')
  const retryInput = reactive<RetryTenantForm>({
    adminLogin: 'admin',
    adminName: '系统管理员',
    initialPassword: '',
    adminEmail: '',
  })
  const loadState = useApiRequestState()
  const mutationState = useApiRequestState()

  async function load(): Promise<void> {
    const result = await getPlatformTenant(tenantId, loadState.options)
    if (result.error !== null) {
      if (result.error.status === 401) redirectToLogin()
      errorMessage.value = result.error.message
      return
    }
    tenant.value = result.data
  }

  async function retry(): Promise<void> {
    errorMessage.value = ''
    const { adminEmail, ...values } = retryInput
    const result = await retryPlatformTenant(
      tenantId,
      {
        ...values,
        adminLogin: retryInput.adminLogin.trim(),
        adminName: retryInput.adminName.trim(),
        ...(adminEmail.trim() ? { adminEmail: adminEmail.trim() } : {}),
      },
      mutationState.options,
    )
    if (result.error !== null) {
      if (result.error.status === 401) redirectToLogin()
      errorMessage.value = result.error.message
      return
    }
    tenant.value = result.data
    retryInput.initialPassword = ''
  }

  async function transition(action: 'suspend' | 'resume' | 'disable'): Promise<void> {
    const result = await transitionPlatformTenant(tenantId, action, mutationState.options)
    if (result.error !== null) {
      if (result.error.status === 401) redirectToLogin()
      errorMessage.value = result.error.message
      return
    }
    tenant.value = result.data
  }

  return {
    tenant,
    retryInput,
    errorMessage,
    loading: loadState.loading,
    mutating: mutationState.loading,
    load,
    retry,
    transition,
  }
}

function redirectToLogin(): void {
  const redirect = window.location.pathname + window.location.search
  window.location.assign(`/platform/login?redirect=${encodeURIComponent(redirect)}`)
}
