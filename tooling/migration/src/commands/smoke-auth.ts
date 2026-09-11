import {
  accessTokenCookieName,
  csrfCookieName,
  csrfHeaderName,
  refreshTokenCookieName,
} from '@jingwei/auth/shared'

/** Explicit command boundary; importing this module performs no I/O. */
export async function runAuthenticationSmokeTest(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const baseUrl = environment.TEST_BASE_URL ?? 'http://127.0.0.1:3000'
  const password = environment.TEST_ADMIN_PASSWORD
  if (password === undefined) {
    throw new Error('TEST_ADMIN_PASSWORD is required')
  }

  const origin = environment.TEST_APP_ORIGIN ?? 'http://localhost:5173'
  const tenantCode = environment.TEST_TENANT_CODE ?? 'default'
  const login = environment.TEST_ADMIN_LOGIN ?? 'admin'

  const rejected = await fetch(`${baseUrl}/api/v1/iam/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ tenantCode, login, password: `${password}-incorrect` }),
  })
  assertStatus(rejected, 401, 'invalid credentials')

  const created = await fetch(`${baseUrl}/api/v1/iam/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ tenantCode, login, password }),
  })
  assertStatus(created, 201, 'login')
  const cookies = readSetCookies(created)
  assertCookie(cookies, accessTokenCookieName)
  assertCookie(cookies, refreshTokenCookieName)
  const csrfToken = assertCookie(cookies, csrfCookieName)
  const initialCookieHeader = cookieHeader(cookies)

  const session = await fetch(`${baseUrl}/api/v1/iam/session`, {
    headers: { cookie: initialCookieHeader },
  })
  assertStatus(session, 200, 'session restore')
  await assertAuthenticated(session, true, 'Session was not restored as authenticated')

  const refreshed = await fetch(`${baseUrl}/api/v1/iam/sessions/refresh`, {
    method: 'POST',
    headers: {
      cookie: initialCookieHeader,
      origin,
      [csrfHeaderName]: csrfToken,
    },
  })
  assertStatus(refreshed, 200, 'refresh rotation')
  const refreshedCookies = new Map(cookies)
  for (const [name, value] of readSetCookies(refreshed)) refreshedCookies.set(name, value)

  const supersededAccess = await fetch(`${baseUrl}/api/v1/iam/session`, {
    headers: { cookie: initialCookieHeader },
  })
  await assertAuthenticated(
    supersededAccess,
    false,
    'Superseded access token remained authenticated',
  )

  const refreshedCookieHeader = cookieHeader(refreshedCookies)
  const navigation = await fetch(`${baseUrl}/api/v1/navigation/me`, {
    headers: { cookie: refreshedCookieHeader },
  })
  assertStatus(navigation, 200, 'authenticated navigation')
  const navigationBody: unknown = await navigation.json()
  if (!isRecord(navigationBody) || !Array.isArray(navigationBody.nodes)) {
    throw new Error('Authenticated navigation did not contain nodes')
  }

  const logout = await fetch(`${baseUrl}/api/v1/iam/sessions/current`, {
    method: 'DELETE',
    headers: {
      cookie: refreshedCookieHeader,
      origin,
      [csrfHeaderName]: csrfToken,
    },
  })
  assertStatus(logout, 204, 'logout')

  const revokedSession = await fetch(`${baseUrl}/api/v1/iam/session`, {
    headers: { cookie: refreshedCookieHeader },
  })
  await assertAuthenticated(revokedSession, false, 'Revoked session remained authenticated')

  console.log('Real authentication smoke test passed')
  console.log(
    'Verified invalid login, access/refresh cookies, refresh rotation, navigation, CSRF logout, and revocation',
  )
}

function readSetCookies(response: Response): Map<string, string> {
  const cookies = new Map<string, string>()
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(';', 1)[0]
    if (pair === undefined) continue
    const separator = pair.indexOf('=')
    if (separator < 1) continue
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1))
  }
  return cookies
}

function assertCookie(cookies: Map<string, string>, name: string): string {
  const value = cookies.get(name)
  if (value === undefined || value.length === 0) {
    throw new Error(`Login did not set ${name}`)
  }
  return value
}

function cookieHeader(cookies: Map<string, string>): string {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ')
}

function assertStatus(response: Response, expected: number, operation: string): void {
  if (response.status !== expected) {
    throw new Error(`${operation} returned ${response.status}; expected ${expected}`)
  }
}

async function assertAuthenticated(
  response: Response,
  expected: boolean,
  message: string,
): Promise<void> {
  assertStatus(response, 200, 'session lookup')
  const body: unknown = await response.json()
  if (!isRecord(body) || body.authenticated !== expected) throw new Error(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
