import type { NavigationResponse } from '@jingwei/module-navigation/shared'

/** A stale browser hint must not make the public login route unrecoverable. */
export async function loadTenantNavigationBootstrap(
  tenantCode: string,
  load: (tenantCode?: string) => Promise<NavigationResponse>,
): Promise<NavigationResponse> {
  try {
    return await load(tenantCode)
  } catch {
    return load()
  }
}
