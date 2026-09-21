import type { Kysely, Selectable, Transaction } from 'kysely'

import { hashOpaqueToken, isValidCsrfToken, newOpaqueToken } from '@jingwei/auth'
import {
  newSessionId,
  toOperatorId,
  toSessionId,
  type Clock,
  type OperatorId,
  type SessionId,
} from '@jingwei/kernel'

import type {
  ControlPlaneDatabase,
  OperatorRefreshTokenTable,
  OperatorSessionTable,
} from './infrastructure/database.js'

export type OperatorSessionRow = Selectable<OperatorSessionTable>
export type OperatorRefreshTokenRow = Selectable<OperatorRefreshTokenTable>

export interface OperatorSessionSnapshot {
  readonly id: SessionId
  readonly operatorId: OperatorId
  readonly csrfTokenHash: string
  readonly accessExpiresAt: Date
  readonly absoluteExpiresAt: Date
}

export interface OperatorSessionCredentials extends OperatorSessionSnapshot {
  readonly accessToken: string
  readonly refreshToken: string
}

export interface CreatedOperatorSession extends OperatorSessionCredentials {
  readonly csrfToken: string
}

export type OperatorRefreshResult =
  | { readonly status: 'refreshed'; readonly session: OperatorSessionCredentials }
  | { readonly status: 'already_rotated' | 'csrf_invalid' | 'invalid' }
  | { readonly status: 'reused'; readonly session: OperatorSessionSnapshot }

export type OperatorSessionRevocationReason =
  | 'LOGIN_FINALIZATION_FAILED'
  | 'LOGOUT'
  | 'REFRESH_TOKEN_REUSE'
  | 'OPERATOR_DISABLED'

interface OperatorRefreshSnapshot {
  readonly session: OperatorSessionRow
  readonly token: OperatorRefreshTokenRow
}

interface RotateOperatorRefreshInput {
  readonly presentedTokenHash: string
  readonly nextToken: OperatorRefreshTokenRow
  readonly nextAccessTokenHash: string
  readonly nextAccessExpiresAt: Date
  readonly nextIdleExpiresAt: Date
  readonly now: Date
  readonly reuseGraceSeconds: number
}

type RotateOperatorRefreshResult =
  | { readonly status: 'rotated'; readonly session: OperatorSessionRow }
  | { readonly status: 'reused'; readonly session: OperatorSessionRow }
  | { readonly status: 'already_rotated' | 'invalid' }

export interface OperatorSessionRepository {
  create(session: OperatorSessionRow, refreshToken: OperatorRefreshTokenRow): Promise<void>
  findActiveByAccessTokenHash(tokenHash: string, now: Date): Promise<OperatorSessionRow | null>
  findByRefreshTokenHash(tokenHash: string): Promise<OperatorRefreshSnapshot | null>
  rotateRefreshToken(input: RotateOperatorRefreshInput): Promise<RotateOperatorRefreshResult>
  updateActivity(
    id: string,
    update: Partial<
      Pick<
        OperatorSessionRow,
        'last_seen_at' | 'idle_expires_at' | 'revoked_at' | 'revocation_reason'
      >
    >,
  ): Promise<void>
  revoke(id: string, revokedAt: Date, reason: OperatorSessionRevocationReason): Promise<void>
}

export interface ActiveOperatorGate {
  isActive(operatorId: OperatorId): Promise<boolean>
}

export class PostgresOperatorSessionRepository implements OperatorSessionRepository {
  constructor(private readonly database: Kysely<ControlPlaneDatabase>) {}

  async create(session: OperatorSessionRow, refreshToken: OperatorRefreshTokenRow): Promise<void> {
    await this.database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('control_plane.operator_session')
        .values(session)
        .executeTakeFirstOrThrow()
      await transaction
        .insertInto('control_plane.operator_refresh_token')
        .values(refreshToken)
        .executeTakeFirstOrThrow()
    })
  }

  async findActiveByAccessTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<OperatorSessionRow | null> {
    const row = await this.database
      .selectFrom('control_plane.operator_session')
      .selectAll()
      .where('access_token_hash', '=', tokenHash)
      .where('access_expires_at', '>', now)
      .where('idle_expires_at', '>', now)
      .where('absolute_expires_at', '>', now)
      .where('revoked_at', 'is', null)
      .executeTakeFirst()
    return row ?? null
  }

  async findByRefreshTokenHash(tokenHash: string): Promise<OperatorRefreshSnapshot | null> {
    const token = await this.database
      .selectFrom('control_plane.operator_refresh_token')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst()
    if (token === undefined) return null
    const session = await this.database
      .selectFrom('control_plane.operator_session')
      .selectAll()
      .where('id', '=', token.session_id)
      .executeTakeFirst()
    return session === undefined ? null : { session, token }
  }

  rotateRefreshToken(input: RotateOperatorRefreshInput): Promise<RotateOperatorRefreshResult> {
    return this.database
      .transaction()
      .execute((transaction) => rotateRefreshTokenInTransaction(transaction, input))
  }

  async updateActivity(
    id: string,
    update: Partial<
      Pick<
        OperatorSessionRow,
        'last_seen_at' | 'idle_expires_at' | 'revoked_at' | 'revocation_reason'
      >
    >,
  ): Promise<void> {
    await this.database
      .updateTable('control_plane.operator_session')
      .set(update)
      .where('id', '=', id)
      .executeTakeFirst()
  }

  revoke(id: string, revokedAt: Date, reason: OperatorSessionRevocationReason): Promise<void> {
    return this.updateActivity(id, { revoked_at: revokedAt, revocation_reason: reason })
  }
}

export class OperatorSessionService {
  constructor(
    private readonly repository: OperatorSessionRepository,
    private readonly operators: ActiveOperatorGate,
    private readonly clock: Clock,
    private readonly expiry: {
      readonly accessSeconds: number
      readonly refreshIdleSeconds: number
      readonly refreshAbsoluteSeconds: number
      readonly refreshReuseGraceSeconds: number
    },
  ) {}

  async create(options: {
    readonly operatorId: OperatorId
    readonly userAgent?: string
    readonly ipAddress?: string
  }): Promise<CreatedOperatorSession> {
    if (!(await this.operators.isActive(options.operatorId))) {
      throw new Error('Cannot create a session for an inactive platform operator')
    }
    const now = this.clock.now()
    const id = newSessionId()
    const accessToken = newOpaqueToken()
    const refreshToken = newOpaqueToken()
    const csrfToken = newOpaqueToken()
    const absoluteExpiresAt = new Date(now.getTime() + this.expiry.refreshAbsoluteSeconds * 1_000)
    const session: OperatorSessionRow = {
      id,
      operator_id: options.operatorId,
      access_token_hash: hashOpaqueToken(accessToken),
      access_expires_at: expiresWithin(now, this.expiry.accessSeconds, absoluteExpiresAt),
      csrf_token_hash: hashOpaqueToken(csrfToken),
      created_at: now,
      last_seen_at: now,
      idle_expires_at: expiresWithin(now, this.expiry.refreshIdleSeconds, absoluteExpiresAt),
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
    return {
      ...toCredentials(session, accessToken, refreshToken),
      csrfToken,
    }
  }

  async authenticateAccess(token: string): Promise<OperatorSessionSnapshot | null> {
    const now = this.clock.now()
    const row = await this.repository.findActiveByAccessTokenHash(hashOpaqueToken(token), now)
    if (row === null) return null
    if (!(await this.operators.isActive(toOperatorId(row.operator_id)))) {
      await this.repository.revoke(row.id, now, 'OPERATOR_DISABLED')
      return null
    }
    await this.repository.updateActivity(row.id, {
      last_seen_at: now,
      idle_expires_at: expiresWithin(now, this.expiry.refreshIdleSeconds, row.absolute_expires_at),
    })
    return toSnapshot(row)
  }

  async refresh(options: {
    readonly refreshToken: string
    readonly csrfCookieToken: string | undefined
    readonly csrfHeaderToken: string | undefined
  }): Promise<OperatorRefreshResult> {
    const now = this.clock.now()
    const presentedTokenHash = hashOpaqueToken(options.refreshToken)
    const found = await this.repository.findByRefreshTokenHash(presentedTokenHash)
    if (found === null || !isRefreshActive(found.session, found.token, now)) {
      return { status: 'invalid' }
    }
    if (!(await this.operators.isActive(toOperatorId(found.session.operator_id)))) {
      await this.repository.revoke(found.session.id, now, 'OPERATOR_DISABLED')
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
      nextAccessExpiresAt: expiresWithin(
        now,
        this.expiry.accessSeconds,
        found.session.absolute_expires_at,
      ),
      nextIdleExpiresAt: expiresWithin(
        now,
        this.expiry.refreshIdleSeconds,
        found.session.absolute_expires_at,
      ),
      now,
      reuseGraceSeconds: this.expiry.refreshReuseGraceSeconds,
    })
    if (rotated.status === 'reused') {
      return { status: 'reused', session: toSnapshot(rotated.session) }
    }
    if (rotated.status !== 'rotated') return rotated
    return {
      status: 'refreshed',
      session: toCredentials(rotated.session, accessToken, refreshToken),
    }
  }

  revoke(sessionId: SessionId, reason: OperatorSessionRevocationReason = 'LOGOUT'): Promise<void> {
    return this.repository.revoke(sessionId, this.clock.now(), reason)
  }
}

async function rotateRefreshTokenInTransaction(
  transaction: Transaction<ControlPlaneDatabase>,
  input: RotateOperatorRefreshInput,
): Promise<RotateOperatorRefreshResult> {
  const token = await transaction
    .selectFrom('control_plane.operator_refresh_token')
    .selectAll()
    .where('token_hash', '=', input.presentedTokenHash)
    .forUpdate()
    .executeTakeFirst()
  if (token === undefined) return { status: 'invalid' }
  const session = await transaction
    .selectFrom('control_plane.operator_session')
    .selectAll()
    .where('id', '=', token.session_id)
    .forUpdate()
    .executeTakeFirst()
  if (session === undefined || !isRefreshActive(session, token, input.now)) {
    return { status: 'invalid' }
  }
  if (token.consumed_at !== null) {
    if (input.now.getTime() <= token.consumed_at.getTime() + input.reuseGraceSeconds * 1_000) {
      return { status: 'already_rotated' }
    }
    const revoked = { ...session, revoked_at: input.now, revocation_reason: 'REFRESH_TOKEN_REUSE' }
    await transaction
      .updateTable('control_plane.operator_session')
      .set({ revoked_at: input.now, revocation_reason: 'REFRESH_TOKEN_REUSE' })
      .where('id', '=', session.id)
      .executeTakeFirstOrThrow()
    return { status: 'reused', session: revoked }
  }
  await transaction
    .updateTable('control_plane.operator_refresh_token')
    .set({ consumed_at: input.now })
    .where('token_hash', '=', token.token_hash)
    .executeTakeFirstOrThrow()
  await transaction
    .insertInto('control_plane.operator_refresh_token')
    .values(input.nextToken)
    .executeTakeFirstOrThrow()
  const next = {
    ...session,
    access_token_hash: input.nextAccessTokenHash,
    access_expires_at: input.nextAccessExpiresAt,
    last_seen_at: input.now,
    idle_expires_at: input.nextIdleExpiresAt,
  }
  await transaction
    .updateTable('control_plane.operator_session')
    .set({
      access_token_hash: next.access_token_hash,
      access_expires_at: next.access_expires_at,
      last_seen_at: next.last_seen_at,
      idle_expires_at: next.idle_expires_at,
    })
    .where('id', '=', session.id)
    .executeTakeFirstOrThrow()
  return { status: 'rotated', session: next }
}

function expiresWithin(now: Date, seconds: number, limit: Date): Date {
  return new Date(Math.min(now.getTime() + seconds * 1_000, limit.getTime()))
}

function isRefreshActive(
  session: OperatorSessionRow,
  token: OperatorRefreshTokenRow,
  now: Date,
): boolean {
  return (
    session.revoked_at === null &&
    session.idle_expires_at > now &&
    session.absolute_expires_at > now &&
    token.expires_at > now
  )
}

function toSnapshot(row: OperatorSessionRow): OperatorSessionSnapshot {
  return {
    id: toSessionId(row.id),
    operatorId: toOperatorId(row.operator_id),
    csrfTokenHash: row.csrf_token_hash,
    accessExpiresAt: row.access_expires_at,
    absoluteExpiresAt: row.absolute_expires_at,
  }
}

function toCredentials(
  row: OperatorSessionRow,
  accessToken: string,
  refreshToken: string,
): OperatorSessionCredentials {
  return { ...toSnapshot(row), accessToken, refreshToken }
}
