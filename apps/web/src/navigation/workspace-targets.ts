import { navigationTarget, type NavigationResponse } from '@jingwei/module-navigation/shared'

/** Prefer configured home; fall back to the first non-public menu, then recovery. */
export function resolveHomeTarget(navigation: NavigationResponse | null): string {
  if (navigation === null) return '/'
  const home =
    navigation.nodes.find((node) => node.code === navigation.homeCode) ??
    navigation.nodes.find((node) => node.type === 'MENU' && node.accessMode !== 'PUBLIC')
  if (home === undefined) return '/__recovery'
  return navigationTarget(home) ?? '/__recovery'
}

/** Login entry from the current (or public) navigation response. */
export function resolveAuthEntryTarget(navigation: NavigationResponse | null): string {
  if (navigation === null) return '/'
  const entry = navigation.nodes.find((node) => node.code === navigation.authEntryCode)
  if (entry === undefined) return '/__recovery'
  return navigationTarget(entry) ?? '/__recovery'
}

/**
 * Same-origin app path only. Blocks protocol-relative URLs, external absolute URLs,
 * and internal recovery/bootstrap surfaces used as open-redirect gadgets.
 */
export function resolveSafeReturnPath(value: unknown): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/'
  if (value.startsWith('/__')) return '/'
  return value
}

export function withRedirectQuery(authEntryPath: string, returnPath: string): string {
  const safe = resolveSafeReturnPath(returnPath)
  const separator = authEntryPath.includes('?') ? '&' : '?'
  return `${authEntryPath}${separator}redirect=${encodeURIComponent(safe)}`
}
