import '@jingwei/ui/theme.css'
import 'virtual:uno.css'
import { isPlatformWebPath } from '@jingwei/control-plane/shared'

/** Select the independently authenticated platform or tenant application by URL namespace. */
export async function startWebApplication(): Promise<void> {
  if (isPlatformWebPath(window.location.pathname)) {
    const { startPlatformWebApplication } = await import('./start-platform-web.js')
    return startPlatformWebApplication()
  }
  const { startTenantWebApplication } = await import('./start-tenant-web.js')
  return startTenantWebApplication()
}
