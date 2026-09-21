const platformWebPrefix = '/platform'
const platformApiPrefix = '/api/v1/platform'

export function hasPathSegmentPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isPlatformWebPath(pathname: string): boolean {
  return hasPathSegmentPrefix(pathname, platformWebPrefix)
}

export function isPlatformApiPath(pathname: string): boolean {
  return hasPathSegmentPrefix(pathname, platformApiPrefix)
}
