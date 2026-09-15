import { computed, ref } from 'vue'

import { useApiRequestState } from '@jingwei/api-client/vue'

import { changeAccountPassword } from '../../client/index.js'
import { setIamSessionUser } from '../../session/index.js'

interface ChangePasswordDependencies {
  change: typeof changeAccountPassword
  leaveWorkspace: () => void
}

/** Owns password-change workflow. Success revokes every session and forces re-authentication. */
export function useChangePassword(
  dependencies: ChangePasswordDependencies = {
    change: changeAccountPassword,
    leaveWorkspace: () => window.location.assign('/'),
  },
) {
  const currentPassword = ref('')
  const newPassword = ref('')
  const confirmPassword = ref('')
  const errorMessage = ref('')
  const successMessage = ref('')
  const requestState = useApiRequestState()

  const canSubmit = computed(
    () =>
      currentPassword.value.length > 0 &&
      newPassword.value.length >= 8 &&
      confirmPassword.value === newPassword.value,
  )

  function reset(): void {
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    errorMessage.value = ''
    successMessage.value = ''
  }

  async function submit(): Promise<void> {
    if (requestState.loading.value) return
    errorMessage.value = ''
    successMessage.value = ''

    if (newPassword.value.length < 8) {
      errorMessage.value = '新密码至少 8 位'
      return
    }
    if (newPassword.value !== confirmPassword.value) {
      errorMessage.value = '两次输入的新密码不一致'
      return
    }

    const { error } = await dependencies.change(
      {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      },
      requestState.options,
    )
    if (error !== null) {
      errorMessage.value = error.message
      return
    }

    setIamSessionUser(null)
    reset()
    successMessage.value = '密码已更新，正在重新登录…'
    dependencies.leaveWorkspace()
  }

  return {
    currentPassword,
    newPassword,
    confirmPassword,
    errorMessage,
    successMessage,
    submitting: requestState.loading,
    canSubmit,
    reset,
    submit,
  }
}
