import { isPlatformWebPath } from '../shared/index.js'

const platformHome = '/platform/tenants'

/** Accept only a normalized same-origin path inside the platform application. */
export function safePlatformRedirect(value: string | null, origin: string): string {
  if (value === null || !value.startsWith('/') || value.startsWith('//')) return platformHome
  try {
    const base = new URL(origin)
    const target = new URL(value, base)
    if (target.origin !== base.origin || !isPlatformWebPath(target.pathname)) return platformHome
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return platformHome
  }
}
