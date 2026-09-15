import { ref } from 'vue'

import { logout } from '@jingwei/module-iam/client'
import { clearIamSessionPermissions, setIamSessionUser } from '@jingwei/module-iam/web'
import { toast } from '@jingwei/ui'

import { useShellStore } from '../stores/shell.js'

interface SignOutDependencies {
  logout: () => Promise<void>
  leaveWorkspace: () => void
}

/** Owns session teardown for shell chrome; the menu only triggers confirmation. */
export function useSignOut(
  dependencies: SignOutDependencies = {
    logout,
    leaveWorkspace: () => window.location.assign('/'),
  },
) {
  const shell = useShellStore()
  const signingOut = ref(false)

  async function signOut(): Promise<void> {
    if (signingOut.value) return
    signingOut.value = true
    try {
      await dependencies.logout()
      shell.currentUser = null
      shell.navigation = null
      setIamSessionUser(null)
      clearIamSessionPermissions()
      dependencies.leaveWorkspace()
    } catch {
      toast.error('退出登录失败，请稍后重试')
    } finally {
      signingOut.value = false
    }
  }

  return { signingOut, signOut }
}
