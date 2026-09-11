import { describe, expect, it, vi } from 'vitest'

import { ApplicationError, toTenantId, toUserId } from '@jingwei/kernel'

import type { AccountProfile } from '../../shared/index.js'
import {
  ChangeAccountPassword,
  ReadAccountProfile,
  ReadAccountRoles,
  UpdateAccountProfile,
} from './account-profile.js'

const tenantId = toTenantId('22222222-2222-7222-8222-222222222222')
const userId = toUserId('11111111-1111-7111-8111-111111111111')

function profile(overrides: Partial<AccountProfile & { passwordHash: string }> = {}) {
  return {
    id: userId,
    username: 'admin',
    displayName: '管理员',
    email: 'admin@example.com',
    phone: null,
    avatarUrl: null,
    status: 'ACTIVE' as const,
    lastLoginAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    passwordChangedAt: '2026-01-01T00:00:00.000Z',
    passwordHash: 'hash',
    ...overrides,
  }
}

function accountStore(
  overrides: {
    findProfile?: () => Promise<ReturnType<typeof profile> | null>
    listActiveRoles?: () => Promise<{ code: string; name: string; status: 'ACTIVE' }[]>
    updateProfile?: () => Promise<void>
    updatePassword?: () => Promise<void>
  } = {},
) {
  return {
    findProfile: vi.fn(overrides.findProfile ?? (() => Promise.resolve(profile()))),
    listActiveRoles: vi.fn(overrides.listActiveRoles ?? (() => Promise.resolve([]))),
    updateProfile: vi.fn(overrides.updateProfile ?? (() => Promise.resolve())),
    updatePassword: vi.fn(overrides.updatePassword ?? (() => Promise.resolve())),
  }
}

describe('ReadAccountProfile', () => {
  it('strips the password hash from the returned projection', async () => {
    const accounts = accountStore()
    const result = await new ReadAccountProfile(accounts).execute({ tenantId, userId })
    expect(result.displayName).toBe('管理员')
    expect(result).not.toHaveProperty('passwordHash')
  })

  it('rejects missing accounts', async () => {
    const accounts = accountStore({ findProfile: () => Promise.resolve(null) })
    await expect(new ReadAccountProfile(accounts).execute({ tenantId, userId })).rejects.toThrow(
      ApplicationError,
    )
  })
})

describe('UpdateAccountProfile', () => {
  it('persists only the provided fields and returns the merged profile', async () => {
    const accounts = accountStore()
    const result = await new UpdateAccountProfile({
      accounts,
      clock: { now: () => new Date('2026-02-01T00:00:00.000Z') },
    }).execute({ tenantId, userId, requestId: 'req' as never }, { displayName: '新名字' })

    expect(result.displayName).toBe('新名字')
    expect(result.avatarUrl).toBeNull()
    expect(accounts.updateProfile).toHaveBeenCalledWith({
      tenantId,
      userId,
      displayName: '新名字',
      avatarUrl: null,
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    })
  })
})

describe('ChangeAccountPassword', () => {
  it('rewrites the hash and revokes every session for the user', async () => {
    const accounts = accountStore()
    const passwords = {
      verify: vi.fn(() => Promise.resolve(true)),
      hash: vi.fn(() => Promise.resolve('new-hash')),
    }
    const revokeUser = vi.fn(() => Promise.resolve())

    await new ChangeAccountPassword({
      accounts,
      passwords,
      sessions: { revokeUser },
      clock: { now: () => new Date('2026-02-01T00:00:00.000Z') },
    }).execute(
      { tenantId, userId, requestId: 'req' as never },
      { currentPassword: 'old', newPassword: 'new-password' },
    )

    expect(passwords.verify).toHaveBeenCalledWith('hash', 'old')
    expect(accounts.updatePassword).toHaveBeenCalledWith({
      userId,
      passwordHash: 'new-hash',
      changedAt: new Date('2026-02-01T00:00:00.000Z'),
    })
    expect(revokeUser).toHaveBeenCalledWith(tenantId, userId)
  })

  it('rejects an incorrect current password without touching credentials', async () => {
    const accounts = accountStore()
    const passwords = {
      verify: vi.fn(() => Promise.resolve(false)),
      hash: vi.fn(() => Promise.resolve('new-hash')),
    }
    const revokeUser = vi.fn(() => Promise.resolve())

    await expect(
      new ChangeAccountPassword({
        accounts,
        passwords,
        sessions: { revokeUser },
        clock: { now: () => new Date() },
      }).execute(
        { tenantId, userId, requestId: 'req' as never },
        { currentPassword: 'wrong', newPassword: 'new-password' },
      ),
    ).rejects.toMatchObject({ code: 'CURRENT_PASSWORD_INVALID' })

    expect(accounts.updatePassword).not.toHaveBeenCalled()
    expect(revokeUser).not.toHaveBeenCalled()
  })
})

describe('ReadAccountRoles', () => {
  it('returns active roles for the current user only', async () => {
    const accounts = accountStore({
      listActiveRoles: () => Promise.resolve([{ code: 'admin', name: '管理员', status: 'ACTIVE' }]),
    })
    const roles = await new ReadAccountRoles(accounts).execute({ tenantId, userId })
    expect(roles).toEqual([{ code: 'admin', name: '管理员', status: 'ACTIVE' }])
    expect(accounts.listActiveRoles).toHaveBeenCalledWith(tenantId, userId)
  })
})
