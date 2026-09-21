import { describe, expect, it, vi } from 'vitest'

import type { PasswordHasher } from '@jingwei/auth'
import { newRequestId, type Clock } from '@jingwei/kernel'

import { BootstrapPlatformOperator, type BootstrapOperatorStore } from './bootstrap-operator.js'

const now = new Date('2026-09-21T09:00:00.000Z')

describe('BootstrapPlatformOperator', () => {
  it('hashes a valid password and delegates one-time creation to the store', async () => {
    const createInitial = vi.fn<BootstrapOperatorStore['createInitial']>((input) =>
      Promise.resolve({ id: input.id, login: input.login, displayName: input.displayName }),
    )
    const hash = vi.fn(() => Promise.resolve('argon-hash'))
    const passwords: PasswordHasher = {
      hash,
      verify: vi.fn(() => Promise.resolve(false)),
    }
    const clock: Clock = { now: () => now }
    const bootstrap = new BootstrapPlatformOperator({ createInitial }, passwords, clock)
    const context = {
      requestId: newRequestId(),
      actor: { type: 'CLI' as const, id: 'bootstrap:root' },
    }

    await expect(
      bootstrap.execute(context, {
        login: ' Root ',
        displayName: ' 平台管理员 ',
        password: 'safe-password',
      }),
    ).resolves.toMatchObject({ login: 'Root', displayName: '平台管理员' })
    expect(hash).toHaveBeenCalledWith('safe-password')
    expect(createInitial).toHaveBeenCalledWith(
      expect.objectContaining({
        context,
        login: 'Root',
        normalizedLogin: 'root',
        displayName: '平台管理员',
        passwordHash: 'argon-hash',
        now,
      }),
    )
  })

  it('rejects short bootstrap passwords before writing', async () => {
    const createInitial = vi.fn<BootstrapOperatorStore['createInitial']>()
    const passwords: PasswordHasher = {
      hash: vi.fn(() => Promise.resolve('unused')),
      verify: vi.fn(() => Promise.resolve(false)),
    }
    const bootstrap = new BootstrapPlatformOperator({ createInitial }, passwords, {
      now: () => now,
    })

    await expect(
      bootstrap.execute(
        { requestId: newRequestId(), actor: { type: 'CLI', id: 'bootstrap:test' } },
        { login: 'root', displayName: 'Root', password: 'short' },
      ),
    ).rejects.toMatchObject({ code: 'PLATFORM_OPERATOR_PASSWORD_INVALID' })
    expect(createInitial).not.toHaveBeenCalled()
  })
})
