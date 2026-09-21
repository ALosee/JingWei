import { reactive, ref } from 'vue'

import { useApiRequestState } from '@jingwei/api-client/vue'

import {
  createPlatformTenant,
  listPlatformTenants,
  transitionPlatformTenant,
} from '../../client/index.js'
import type { CreatePlatformTenant, PlatformTenant } from '../../shared/index.js'

type CreateTenantForm = Omit<CreatePlatformTenant, 'adminEmail'> & { adminEmail: string }

const initialCreateInput = (): CreateTenantForm => ({
  code: '',
  name: '',
  defaultLocale: 'zh-CN',
  defaultTimezone: 'Asia/Shanghai',
  defaultCurrency: 'CNY',
  adminLogin: 'admin',
  adminName: '系统管理员',
  initialPassword: '',
  adminEmail: '',
})

export function usePlatformTenants() {
  const tenants = ref<PlatformTenant[]>([])
  const errorMessage = ref('')
  const creationOpen = ref(false)
  const creation = reactive<CreateTenantForm>(initialCreateInput())
  const listState = useApiRequestState()
  const mutationState = useApiRequestState()

  async function load(): Promise<void> {
    errorMessage.value = ''
    const result = await listPlatformTenants(listState.options)
    if (result.error !== null) {
      if (result.error.status === 401) redirectToLogin()
      errorMessage.value = result.error.message
      return
    }
    tenants.value = result.data.tenants
  }

  async function create(): Promise<void> {
    errorMessage.value = ''
    const { adminEmail, ...values } = creation
    const input: CreatePlatformTenant = {
      ...values,
      code: creation.code.trim(),
      name: creation.name.trim(),
      adminLogin: creation.adminLogin.trim(),
      adminName: creation.adminName.trim(),
      ...(adminEmail.trim() ? { adminEmail: adminEmail.trim() } : {}),
    }
    const result = await createPlatformTenant(input, mutationState.options)
    if (result.error !== null) {
      if (result.error.status === 401) redirectToLogin()
      errorMessage.value = result.error.message
      return
    }
    tenants.value = [result.data, ...tenants.value]
    Object.assign(creation, initialCreateInput())
    creationOpen.value = false
  }

  async function transition(
    tenant: PlatformTenant,
    action: 'suspend' | 'resume' | 'disable',
  ): Promise<void> {
    errorMessage.value = ''
    const result = await transitionPlatformTenant(tenant.id, action, mutationState.options)
    if (result.error !== null) {
      if (result.error.status === 401) redirectToLogin()
      errorMessage.value = result.error.message
      return
    }
    tenants.value = tenants.value.map((item) => (item.id === result.data.id ? result.data : item))
  }

  return {
    tenants,
    errorMessage,
    creationOpen,
    creation,
    loading: listState.loading,
    mutating: mutationState.loading,
    load,
    create,
    transition,
  }
}

function redirectToLogin(): void {
  const redirect = window.location.pathname + window.location.search
  window.location.assign(`/platform/login?redirect=${encodeURIComponent(redirect)}`)
}
