import { subscribeSessionExpired } from '@jingwei/api-client'
import { clearIamSessionPermissions, setIamSessionUser } from '@jingwei/module-iam/web'

import { resolveAuthEntryTarget, withRedirectQuery } from '../navigation/workspace-targets.js'
import { useShellStore } from '../stores/shell.js'

/** Shell owns expiry policy: clear identity state, then leave for authEntry with a safe return path. */
export function installSessionExpiryRedirect(
  leave: (url: string) => void = (url) => window.location.assign(url),
  currentLocation: () => string = () =>
    window.location.pathname + window.location.search + window.location.hash,
): () => void {
  const shell = useShellStore()
  return subscribeSessionExpired(() => {
    const authEntry = resolveAuthEntryTarget(shell.navigation)
    const target = authEntry === '/__recovery' ? '/' : authEntry
    const url = withRedirectQuery(target, currentLocation())
    shell.currentUser = null
    shell.navigation = null
    setIamSessionUser(null)
    clearIamSessionPermissions()
    leave(url)
  })
}
