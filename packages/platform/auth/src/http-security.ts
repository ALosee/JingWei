import { createHash, timingSafeEqual } from 'node:crypto'

export { sessionCookieName, csrfCookieName, csrfHeaderName } from './shared.js'

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Returns whether a method can change state and therefore requires an allowed Origin. */
export function requiresOriginValidation(method: string): boolean {
  return !safeMethods.has(method.toUpperCase())
}

/** Exact-origin allow check. The configured origin must already be normalized by configuration. */
export function isAllowedOrigin(origin: string | null, allowedOrigin: string): boolean {
  return origin !== null && origin === allowedOrigin
}

/**
 * Validates the double-submit CSRF cookie/header pair against the digest stored in the session.
 * Call only after session authentication; anonymous unsafe requests are still protected by Origin.
 */
export function isValidCsrfToken(options: {
  readonly cookieToken: string | undefined
  readonly headerToken: string | undefined
  readonly expectedHash: string
}): boolean {
  return (
    options.cookieToken !== undefined &&
    options.headerToken !== undefined &&
    options.cookieToken === options.headerToken &&
    tokenMatchesExpected(options.cookieToken, options.expectedHash)
  )
}

function tokenMatchesExpected(token: string, expectedHash: string): boolean {
  const actualHash = Buffer.from(hashToken(token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actualHash.length === expected.length && timingSafeEqual(actualHash, expected)
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}
