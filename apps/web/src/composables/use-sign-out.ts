import { ref } from 'vue'

import { logout } from '@jingwei/module-iam/client'
import {
  clearIamSessionPermissions,
  rememberedTenantSignInPath,
  setIamSessionUser,
} from '@jingwei/module-iam/web'
import { toast } from '@jingwei/ui'

import { useAppearanceStore } from '../stores/appearance.js'
import { useLayoutStore } from '../stores/layout.js'
import { useShellStore } from '../stores/shell.js'

interface SignOutDependencies {
  logout: () => Promise<void>
  leaveWorkspace: () => void
}

/** Owns session teardown for shell chrome; the menu only triggers confirmation. */
export function useSignOut(
  dependencies: SignOutDependencies = {
    logout,
    leaveWorkspace: () => window.location.assign(rememberedTenantSignInPath()),
  },
) {
  const shell = useShellStore()
  const appearance = useAppearanceStore()
  const layout = useLayoutStore()
  const signingOut = ref(false)

  async function signOut(): Promise<void> {
    if (signingOut.value) return
    signingOut.value = true
    try {
      await dependencies.logout()
      shell.currentUser = null
      shell.navigation = null
      appearance.setUserScope(null, null)
      layout.setUserScope(null, null)
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
