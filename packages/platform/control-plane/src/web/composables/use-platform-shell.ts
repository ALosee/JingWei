import { ref } from 'vue'

import { logoutPlatformOperator } from '../../client/index.js'
import { setPlatformOperator } from '../state.js'

export function usePlatformShell() {
  const signingOut = ref(false)

  async function signOut(): Promise<void> {
    if (signingOut.value) return
    signingOut.value = true
    try {
      await logoutPlatformOperator()
    } finally {
      setPlatformOperator(null)
      window.location.assign('/platform/login')
    }
  }

  return { signingOut, signOut }
}
