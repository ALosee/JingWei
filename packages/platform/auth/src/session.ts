import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import type { Kysely, Selectable, Transaction } from 'kysely'

import {
  newSessionId,
  toSessionId,
  toTenantId,
  toUserId,
  type Clock,
  type SessionId,
  type TenantId,
  type UserId,
} from '@jingwei/kernel'

import { isValidCsrfToken } from './http-security.js'

export interface AuthSessionTable {
  id: string
  tenant_id: string
  user_id: string
  access_token_hash: string
  access_expires_at: Date
  csrf_token_hash: string
  created_at: Date
  last_seen_at: Date
  idle_expires_at: Date
  absolute_expires_at: Date
  revoked_at: Date | null
  revocation_reason: string | null
  user_agent: string | null
  ip_address: string | null
}

export interface AuthRefreshTokenTable {
  token_hash: string
  session_id: string
  generation: number
  issued_at: Date
  expires_at: Date
  consumed_at: Date | null
}

export interface AuthDatabase {
  'platform.auth_refresh_token': AuthRefreshTokenTable
  'platform.auth_session': AuthSessionTable
}

export type SessionRow = Selectable<AuthSessionTable>
export type RefreshTokenRow = Selectable<AuthRefreshTokenTable>

export interface SessionActivityUpdate {
  readonly last_seen_at?: Date
  readonly idle_expires_at?: Date
  readonly revoked_at?: Date | null
  readonly revocation_reason?: string | null
}

export interface SessionSnapshot {
  readonly id: SessionId
  readonly tenantId: TenantId
  readonly userId: UserId
  readonly csrfTokenHash: string
  readonly accessExpiresAt: Date
  readonly absoluteExpiresAt: Date
}

export interface SessionCredentials extends SessionSnapshot {
  /** Short-lived raw access credential. It may only be written to an HttpOnly cookie. */
  readonly accessToken: string
  /** Rotating raw refresh credential. It may only be written to an HttpOnly cookie. */
  readonly refreshToken: string
}

export interface CreatedSession extends SessionCredentials {
  /** Raw double-submit secret. Never persist or log this value; persist only its hash. */
  readonly csrfToken: string
}

export type SessionRevocationReason =
  | 'LOGIN_FINALIZATION_FAILED'
  | 'LOGOUT'
  | 'REFRESH_TOKEN_REUSE'
  | 'TOKEN_ARCHITECTURE_MIGRATION'
  | 'USER_SECURITY_CHANGE'
  | 'TENANT_INACTIVE'

export type RefreshSessionResult =
  | { readonly status: 'refreshed'; readonly session: SessionCredentials }
  | { readonly status: 'already_rotated' }
  | { readonly status: 'csrf_invalid' }
  | { readonly status: 'invalid' }
  | { readonly status: 'reused'; readonly session: SessionSnapshot }

export interface RefreshTokenSnapshot {
  readonly session: SessionRow
  readonly token: RefreshTokenRow
}

export interface RotateRefreshInput {
  readonly presentedTokenHash: string
  readonly nextToken: RefreshTokenRow
  readonly nextAccessTokenHash: string
  readonly nextAccessExpiresAt: Date
  readonly nextIdleExpiresAt: Date
  readonly now: Date
  readonly reuseGraceSeconds: number
}

export type RotateRefreshResult =
  | { readonly status: 'rotated'; readonly session: SessionRow }
  | { readonly status: 'reused'; readonly session: SessionRow }
  | { readonly status: 'already_rotated' | 'invalid' }

/**
 * Persistence port for an opaque access/refresh token family.
 *
 * Creation and refresh rotation are atomic operations. `rotateRefreshToken` consumes exactly one
 * refresh generation before publishing its successor so a token can never be successfully used
 * twice. Consumed generations remain as hash-only evidence for replay detection.
 */
export interface SessionRepository {
  create(session: SessionRow, refreshToken: RefreshTokenRow): Promise<void>
  findActiveByAccessTokenHash(tokenHash: string, now: Date): Promise<SessionRow | null>
  findByRefreshTokenHash(tokenHash: string): Promise<RefreshTokenSnapshot | null>
  rotateRefreshToken(input: RotateRefreshInput): Promise<RotateRefreshResult>
  updateActivity(id: string, update: SessionActivityUpdate): Promise<void>
  revoke(id: string, revokedAt: Date, reason: SessionRevocationReason): Promise<void>
  revokeUser(
    tenantId: string,
    userId: string,
    revokedAt: Date,
    reason: SessionRevocationReason,
  ): Promise<void>
  revokeTenant(tenantId: string, revokedAt: Date, reason: SessionRevocationReason): Promise<void>
}

/** Consumer-owned activity gate; the tenancy package supplies the runtime implementation. */
export interface ActiveTenantGate {
  isActive(tenantId: TenantId): Promise<boolean>
}

export class TenantInactiveSessionError extends Error {
  constructor() {
    super('Cannot create a session for an inactive tenant')
    this.name = 'TenantInactiveSessionError'
  }
}

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly database: Kysely<AuthDatabase>) {}

  async create(session: SessionRow, refreshToken: RefreshTokenRow): Promise<void> {
    await this.database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('platform.auth_session')
        .values(session)
        .executeTakeFirstOrThrow()
      await transaction
        .insertInto('platform.auth_refresh_token')
        .values(refreshToken)
        .executeTakeFirstOrThrow()
    })
  }

  async findActiveByAccessTokenHash(tokenHash: string, now: Date): Promise<SessionRow | null> {
    const row = await this.database
      .selectFrom('platform.auth_session')
      .selectAll()
      .where('access_token_hash', '=', tokenHash)
      .where('access_expires_at', '>', now)
      .where('revoked_at', 'is', null)
      .where('idle_expires_at', '>', now)
      .where('absolute_expires_at', '>', now)
      .executeTakeFirst()

    return row ?? null
  }

  async findByRefreshTokenHash(tokenHash: string): Promise<RefreshTokenSnapshot | null> {
    const token = await this.database
      .selectFrom('platform.auth_refresh_token')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst()
    if (token === undefined) return null

    const session = await this.database
      .selectFrom('platform.auth_session')
      .selectAll()
      .where('id', '=', token.session_id)
      .executeTakeFirst()
    return session === undefined ? null : { session, token }
  }

  rotateRefreshToken(input: RotateRefreshInput): Promise<RotateRefreshResult> {
    return this.database
      .transaction()
      .execute((transaction) => rotateRefreshTokenInTransaction(transaction, input))
  }

  async updateActivity(id: string, update: SessionActivityUpdate): Promise<void> {
    await this.database
      .updateTable('platform.auth_session')
      .set(update)
      .where('id', '=', id)
      .executeTakeFirst()
  }

  async revoke(id: string, revokedAt: Date, reason: SessionRevocationReason): Promise<void> {
    await this.updateActivity(id, { revoked_at: revokedAt, revocation_reason: reason })
  }

  async revokeUser(
    tenantId: string,
    userId: string,
    revokedAt: Date,
    reason: SessionRevocationReason,
  ): Promise<void> {
    await this.database
      .updateTable('platform.auth_session')
      .set({ revoked_at: revokedAt, revocation_reason: reason })
      .where('tenant_id', '=', tenantId)
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute()
  }

  async revokeTenant(
    tenantId: string,
    revokedAt: Date,
    reason: SessionRevocationReason,
  ): Promise<void> {
    await this.database
      .updateTable('platform.auth_session')
      .set({ revoked_at: revokedAt, revocation_reason: reason })
      .where('tenant_id', '=', tenantId)
      .where('revoked_at', 'is', null)
      .execute()
  }
}

async function rotateRefreshTokenInTransaction(
  transaction: Transaction<AuthDatabase>,
  input: RotateRefreshInput,
): Promise<RotateRefreshResult> {
  const token = await transaction
    .selectFrom('platform.auth_refresh_token')
    .selectAll()
    .where('token_hash', '=', input.presentedTokenHash)
    .forUpdate()
    .executeTakeFirst()
  if (token === undefined) return { status: 'invalid' }

  const session = await transaction
    .selectFrom('platform.auth_session')
    .selectAll()
    .where('id', '=', token.session_id)
    .forUpdate()
    .executeTakeFirst()
  if (session === undefined || !isRefreshActive(session, token, input.now)) {
    return { status: 'invalid' }
  }

  if (token.consumed_at !== null) {
    const graceEndsAt = token.consumed_at.getTime() + input.reuseGraceSeconds * 1_000
    if (input.now.getTime() <= graceEndsAt) return { status: 'already_rotated' }

    const revokedSession = {
      ...session,
      revoked_at: input.now,
      revocation_reason: 'REFRESH_TOKEN_REUSE',
    }
    await transaction
      .updateTable('platform.auth_session')
      .set({
        revoked_at: revokedSession.revoked_at,
        revocation_reason: revokedSession.revocation_reason,
      })
      .where('id', '=', session.id)
      .executeTakeFirst()
    return { status: 'reused', session: revokedSession }
  }

  await transaction
    .updateTable('platform.auth_refresh_token')
    .set({ consumed_at: input.now })
    .where('token_hash', '=', token.token_hash)
    .executeTakeFirstOrThrow()
  await transaction
    .insertInto('platform.auth_refresh_token')
    .values(input.nextToken)
    .executeTakeFirstOrThrow()

  const nextSession = {
    ...session,
    access_token_hash: input.nextAccessTokenHash,
    access_expires_at: input.nextAccessExpiresAt,
    last_seen_at: input.now,
    idle_expires_at: input.nextIdleExpiresAt,
  }
  await transaction
    .updateTable('platform.auth_session')
    .set({
      access_token_hash: nextSession.access_token_hash,
      access_expires_at: nextSession.access_expires_at,
      last_seen_at: nextSession.last_seen_at,
      idle_expires_at: nextSession.idle_expires_at,
    })
    .where('id', '=', session.id)
    .executeTakeFirstOrThrow()

  return { status: 'rotated', session: nextSession }
}

export function newOpaqueToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Compares a raw token with a stored SHA-256 digest using a timing-safe equality check. */
export function tokenMatchesHash(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOpaqueToken(token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/**
 * Creates, authenticates, rotates, and revokes server-side opaque token families.
 *
 * The database receives only hashes. Access credentials are short-lived; refresh credentials are
 * one-time generations governed by idle and absolute family limits. A consumed refresh token is
 * retained to detect replay and revoke the whole family after the concurrency grace window.
 */
export class SessionService {
  constructor(
    private readonly repository: SessionRepository,
    private readonly clock: Clock,
    private readonly expiry: {
      readonly accessSeconds: number
      readonly refreshIdleSeconds: number
      readonly refreshAbsoluteSeconds: number
      readonly refreshReuseGraceSeconds: number
    },
    private readonly tenants: ActiveTenantGate,
  ) {}

  async create(options: {
    readonly tenantId: TenantId
    readonly userId: UserId
    readonly userAgent?: string
    readonly ipAddress?: string
  }): Promise<CreatedSession> {
    if (!(await this.tenants.isActive(options.tenantId))) throw new TenantInactiveSessionError()
    const now = this.clock.now()
    const id = newSessionId()
    const accessToken = newOpaqueToken()
    const refreshToken = newOpaqueToken()
    const csrfToken = newOpaqueToken()
    const absoluteExpiresAt = new Date(now.getTime() + this.expiry.refreshAbsoluteSeconds * 1_000)
    const accessExpiresAt = expiresWithin(now, this.expiry.accessSeconds, absoluteExpiresAt)
    const idleExpiresAt = expiresWithin(now, this.expiry.refreshIdleSeconds, absoluteExpiresAt)

    const session: SessionRow = {
      id,
      tenant_id: options.tenantId,
      user_id: options.userId,
      access_token_hash: hashOpaqueToken(accessToken),
      access_expires_at: accessExpiresAt,
      csrf_token_hash: hashOpaqueToken(csrfToken),
      created_at: now,
      last_seen_at: now,
      idle_expires_at: idleExpiresAt,
      absolute_expires_at: absoluteExpiresAt,
      revoked_at: null,
      revocation_reason: null,
      user_agent: options.userAgent ?? null,
      ip_address: options.ipAddress ?? null,
    }
    await this.repository.create(session, {
      token_hash: hashOpaqueToken(refreshToken),
      session_id: id,
      generation: 0,
      issued_at: now,
      expires_at: absoluteExpiresAt,
      consumed_at: null,
    })

    return toCreatedSession(session, accessToken, refreshToken, csrfToken)
  }

  /** Authenticates the current short-lived access credential and extends family idle activity. */
  async authenticateAccess(token: string): Promise<SessionSnapshot | null> {
    const now = this.clock.now()
    const row = await this.repository.findActiveByAccessTokenHash(hashOpaqueToken(token), now)
    if (row === null) return null
    if (!(await this.tenants.isActive(toTenantId(row.tenant_id)))) {
      await this.repository.revoke(row.id, now, 'TENANT_INACTIVE')
      return null
    }

    const idleExpiresAt = expiresWithin(
      now,
      this.expiry.refreshIdleSeconds,
      row.absolute_expires_at,
    )
    await this.repository.updateActivity(row.id, {
      last_seen_at: now,
      idle_expires_at: idleExpiresAt,
    })
    return toSessionSnapshot(row)
  }

  async refresh(options: {
    readonly refreshToken: string
    readonly csrfCookieToken: string | undefined
    readonly csrfHeaderToken: string | undefined
  }): Promise<RefreshSessionResult> {
    const now = this.clock.now()
    const presentedTokenHash = hashOpaqueToken(options.refreshToken)
    const found = await this.repository.findByRefreshTokenHash(presentedTokenHash)
    if (found === null || !isRefreshActive(found.session, found.token, now)) {
      return { status: 'invalid' }
    }
    if (!(await this.tenants.isActive(toTenantId(found.session.tenant_id)))) {
      await this.repository.revoke(found.session.id, now, 'TENANT_INACTIVE')
      return { status: 'invalid' }
    }
    if (
      !isValidCsrfToken({
        cookieToken: options.csrfCookieToken,
        headerToken: options.csrfHeaderToken,
        expectedHash: found.session.csrf_token_hash,
      })
    ) {
      return { status: 'csrf_invalid' }
    }

    const accessToken = newOpaqueToken()
    const refreshToken = newOpaqueToken()
    const accessExpiresAt = expiresWithin(
      now,
      this.expiry.accessSeconds,
      found.session.absolute_expires_at,
    )
    const idleExpiresAt = expiresWithin(
      now,
      this.expiry.refreshIdleSeconds,
      found.session.absolute_expires_at,
    )
    const rotated = await this.repository.rotateRefreshToken({
      presentedTokenHash,
      nextToken: {
        token_hash: hashOpaqueToken(refreshToken),
        session_id: found.session.id,
        generation: found.token.generation + 1,
        issued_at: now,
        expires_at: found.session.absolute_expires_at,
        consumed_at: null,
      },
      nextAccessTokenHash: hashOpaqueToken(accessToken),
      nextAccessExpiresAt: accessExpiresAt,
      nextIdleExpiresAt: idleExpiresAt,
      now,
      reuseGraceSeconds: this.expiry.refreshReuseGraceSeconds,
    })
    if (rotated.status === 'reused') {
      return { status: 'reused', session: toSessionSnapshot(rotated.session) }
    }
    if (rotated.status !== 'rotated') return rotated

    return {
      status: 'refreshed',
      session: toSessionCredentials(rotated.session, accessToken, refreshToken),
    }
  }

  revoke(sessionId: SessionId, reason: SessionRevocationReason = 'LOGOUT'): Promise<void> {
    return this.repository.revoke(sessionId, this.clock.now(), reason)
  }

  revokeUser(tenantId: TenantId, userId: UserId): Promise<void> {
    return this.repository.revokeUser(tenantId, userId, this.clock.now(), 'USER_SECURITY_CHANGE')
  }

  revokeTenant(tenantId: TenantId): Promise<void> {
    return this.repository.revokeTenant(tenantId, this.clock.now(), 'TENANT_INACTIVE')
  }
}

function expiresWithin(now: Date, seconds: number, limit: Date): Date {
  return new Date(Math.min(now.getTime() + seconds * 1_000, limit.getTime()))
}

function isRefreshActive(session: SessionRow, token: RefreshTokenRow, now: Date): boolean {
  return (
    session.revoked_at === null &&
    session.idle_expires_at > now &&
    session.absolute_expires_at > now &&
    token.expires_at > now
  )
}

function toSessionSnapshot(row: SessionRow): SessionSnapshot {
  return {
    id: toSessionId(row.id),
    tenantId: toTenantId(row.tenant_id),
    userId: toUserId(row.user_id),
    csrfTokenHash: row.csrf_token_hash,
    accessExpiresAt: row.access_expires_at,
    absoluteExpiresAt: row.absolute_expires_at,
  }
}

function toCreatedSession(
  row: SessionRow,
  accessToken: string,
  refreshToken: string,
  csrfToken: string,
): CreatedSession {
  return {
    ...toSessionCredentials(row, accessToken, refreshToken),
    csrfToken,
  }
}

function toSessionCredentials(
  row: SessionRow,
  accessToken: string,
  refreshToken: string,
): SessionCredentials {
  return {
    ...toSessionSnapshot(row),
    accessToken,
    refreshToken,
  }
}
