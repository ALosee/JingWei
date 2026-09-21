const storageKey = 'jingwei.iam.last-tenant-code.v1'
const fallbackTenantCode = 'default'

/** Resolve an untrusted display hint; this value never establishes an authenticated tenant. */
export function selectTenantLoginHint(
  search: string,
  storedTenantCode: string | null,
  fallback = fallbackTenantCode,
): string {
  const explicit = normalizeTenantCode(new URLSearchParams(search).get('tenantCode'))
  if (explicit !== null) return explicit
  const stored = normalizeTenantCode(storedTenantCode)
  if (stored !== null) return stored
  return normalizeTenantCode(fallback) ?? fallbackTenantCode
}

export function currentTenantLoginHint(): string {
  if (typeof window === 'undefined') return fallbackTenantCode
  return selectTenantLoginHint(window.location.search, readStoredTenantCode())
}

/** Persist only after successful authentication so typos and failed attempts do not become defaults. */
export function rememberSuccessfulTenantCode(tenantCode: string): void {
  const normalized = normalizeTenantCode(tenantCode)
  if (normalized === null || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, normalized)
  } catch {
    // Private browsing and storage policy may deny persistence; login must continue normally.
  }
}

export function rememberedTenantSignInPath(): string {
  const tenantCode = currentTenantLoginHint()
  return `/signin?tenantCode=${encodeURIComponent(tenantCode)}`
}

function readStoredTenantCode(): string | null {
  try {
    return window.localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

function normalizeTenantCode(value: string | null): string | null {
  const normalized = value?.trim().toLocaleLowerCase('en-US') ?? ''
  return /^[a-z][a-z0-9-]{0,62}$/u.test(normalized) ? normalized : null
}
