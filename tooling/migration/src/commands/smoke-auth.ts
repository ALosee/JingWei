/** Explicit command boundary; importing this module performs no I/O. */
export async function runAuthenticationSmokeTest(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
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
  const loginBody: unknown = await created.json()
  const csrfToken = readString(loginBody, 'csrfToken')
  const cookie = created.headers
    .getSetCookie()
    .map((value) => value.split(';', 1)[0])
    .filter((value): value is string => value !== undefined)
    .join('; ')
  if (cookie.length === 0) throw new Error('Login did not set session cookies')

  const session = await fetch(`${baseUrl}/api/v1/iam/session`, {
    headers: { cookie },
  })
  assertStatus(session, 200, 'session restore')
  const sessionBody: unknown = await session.json()
  if (!isRecord(sessionBody) || sessionBody.authenticated !== true) {
    throw new Error('Session was not restored as authenticated')
  }

  const navigation = await fetch(`${baseUrl}/api/v1/navigation/me`, {
    headers: { cookie },
  })
  assertStatus(navigation, 200, 'authenticated navigation')
  const navigationBody: unknown = await navigation.json()
  if (!isRecord(navigationBody) || !Array.isArray(navigationBody.nodes)) {
    throw new Error('Authenticated navigation did not contain nodes')
  }

  const logout = await fetch(`${baseUrl}/api/v1/iam/sessions/current`, {
    method: 'DELETE',
    headers: { cookie, origin, 'x-csrf-token': csrfToken },
  })
  assertStatus(logout, 204, 'logout')

  const revokedSession = await fetch(`${baseUrl}/api/v1/iam/session`, {
    headers: { cookie },
  })
  assertStatus(revokedSession, 200, 'revoked session lookup')
  const revokedBody: unknown = await revokedSession.json()
  if (!isRecord(revokedBody) || revokedBody.authenticated !== false) {
    throw new Error('Revoked session remained authenticated')
  }

  console.log('Real authentication smoke test passed')
  console.log('Verified invalid login, session creation, restore, navigation, CSRF logout, and revocation')

  function assertStatus(response: Response, expected: number, operation: string): void {
    if (response.status !== expected) {
      throw new Error(`${operation} returned ${response.status}; expected ${expected}`)
    }
  }

  function readString(value: unknown, key: string): string {
    if (!isRecord(value) || typeof value[key] !== 'string') {
      throw new Error(`Response field ${key} is missing`)
    }
    return value[key]
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
  }
}
