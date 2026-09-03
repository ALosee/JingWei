import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import type { Kysely, Selectable } from 'kysely'

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

export interface AuthSessionTable {
  id: string
  tenant_id: string
  user_id: string
  token_hash: string
  csrf_token_hash: string
  created_at: Date
  last_seen_at: Date
  idle_expires_at: Date
  absolute_expires_at: Date
  revoked_at: Date | null
  user_agent: string | null
  ip_address: string | null
}

export interface AuthDatabase {
  'platform.auth_session': AuthSessionTable
}

export type SessionRow = Selectable<AuthSessionTable>
export interface SessionActivityUpdate {
  readonly last_seen_at?: Date
  readonly idle_expires_at?: Date
  readonly revoked_at?: Date | null
}

export interface SessionSnapshot {
  readonly id: SessionId
  readonly tenantId: TenantId
  readonly userId: UserId
  readonly csrfTokenHash: string
  readonly absoluteExpiresAt: Date
}

export interface CreatedSession extends SessionSnapshot {
  /** Raw bearer secret. It is returned only so the HTTP boundary can set a secure cookie. */
  readonly token: string
  /** Raw double-submit secret. Never persist or log this value; persist only its hash. */
  readonly csrfToken: string
}

/**
 * Persistence port for opaque sessions. `findActiveByTokenHash` must enforce revocation and both
 * expiry limits in the query, rather than returning expired rows for callers to filter.
 */
export interface SessionRepository {
  insert(row: SessionRow): Promise<void>
  findActiveByTokenHash(tokenHash: string, now: Date): Promise<SessionRow | null>
  updateActivity(id: string, update: SessionActivityUpdate): Promise<void>
  revoke(id: string, revokedAt: Date): Promise<void>
  revokeUser(tenantId: string, userId: string, revokedAt: Date): Promise<void>
}

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly database: Kysely<AuthDatabase>) {}

  async insert(row: SessionRow): Promise<void> {
    await this.database.insertInto('platform.auth_session').values(row).executeTakeFirstOrThrow()
  }

  async findActiveByTokenHash(tokenHash: string, now: Date): Promise<SessionRow | null> {
    const row = await this.database
      .selectFrom('platform.auth_session')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .where('revoked_at', 'is', null)
      .where('idle_expires_at', '>', now)
      .where('absolute_expires_at', '>', now)
      .executeTakeFirst()

    return row ?? null
  }

  async updateActivity(id: string, update: SessionActivityUpdate): Promise<void> {
    await this.database
      .updateTable('platform.auth_session')
      .set(update)
      .where('id', '=', id)
      .executeTakeFirst()
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await this.updateActivity(id, { revoked_at: revokedAt })
  }

  async revokeUser(tenantId: string, userId: string, revokedAt: Date): Promise<void> {
    await this.database
      .updateTable('platform.auth_session')
      .set({ revoked_at: revokedAt })
      .where('tenant_id', '=', tenantId)
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute()
  }
}

function opaqueToken(): string {
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
 * Creates, authenticates, extends, and revokes server-side sessions.
 *
 * The database receives only token hashes. Successful authentication slides the idle expiry but
 * never beyond the absolute expiry. A `null` result intentionally does not reveal whether the
 * token was unknown, expired, or revoked.
 */
export class SessionService {
  constructor(
    private readonly repository: SessionRepository,
    private readonly clock: Clock,
    private readonly expiry: {
      readonly idleSeconds: number
      readonly absoluteSeconds: number
    },
  ) {}

  async create(options: {
    readonly tenantId: TenantId
    readonly userId: UserId
    readonly userAgent?: string
    readonly ipAddress?: string
  }): Promise<CreatedSession> {
    const now = this.clock.now()
    const token = opaqueToken()
    const csrfToken = opaqueToken()
    const id = newSessionId()
    const absoluteExpiresAt = new Date(now.getTime() + this.expiry.absoluteSeconds * 1_000)

    await this.repository.insert({
      id,
      tenant_id: options.tenantId,
      user_id: options.userId,
      token_hash: hashOpaqueToken(token),
      csrf_token_hash: hashOpaqueToken(csrfToken),
      created_at: now,
      last_seen_at: now,
      idle_expires_at: new Date(now.getTime() + this.expiry.idleSeconds * 1_000),
      absolute_expires_at: absoluteExpiresAt,
      revoked_at: null,
      user_agent: options.userAgent ?? null,
      ip_address: options.ipAddress ?? null,
    })

    return {
      id,
      tenantId: options.tenantId,
      userId: options.userId,
      token,
      csrfToken,
      csrfTokenHash: hashOpaqueToken(csrfToken),
      absoluteExpiresAt,
    }
  }

  /** Authenticates an opaque token and updates last activity, or returns `null` without disclosure. */
  async authenticate(token: string): Promise<SessionSnapshot | null> {
    const now = this.clock.now()
    const row = await this.repository.findActiveByTokenHash(hashOpaqueToken(token), now)

    if (row === null) {
      return null
    }

    const idleExpiresAt = new Date(
      Math.min(
        now.getTime() + this.expiry.idleSeconds * 1_000,
        row.absolute_expires_at.getTime(),
      ),
    )

    await this.repository.updateActivity(row.id, {
      last_seen_at: now,
      idle_expires_at: idleExpiresAt,
    })

    return {
      id: toSessionId(row.id),
      tenantId: toTenantId(row.tenant_id),
      userId: toUserId(row.user_id),
      csrfTokenHash: row.csrf_token_hash,
      absoluteExpiresAt: row.absolute_expires_at,
    }
  }

  revoke(sessionId: SessionId): Promise<void> {
    return this.repository.revoke(sessionId, this.clock.now())
  }

  revokeUser(tenantId: TenantId, userId: UserId): Promise<void> {
    return this.repository.revokeUser(tenantId, userId, this.clock.now())
  }
}
