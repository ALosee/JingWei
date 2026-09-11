// @vitest-environment happy-dom
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toast } from '@jingwei/ui'

import { useShellStore } from '../stores/shell.js'
import { useSignOut } from './use-sign-out.js'

vi.mock('@jingwei/ui', () => ({
  toast: { error: vi.fn() },
}))

describe('useSignOut', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('clears shell session and leaves the workspace after a successful logout', async () => {
    const shell = useShellStore()
    shell.currentUser = {
      id: '11111111-1111-7111-8111-111111111111',
      tenantId: '22222222-2222-7222-8222-222222222222',
      displayName: '张三',
      avatarUrl: null,
    }
    shell.navigation = {
      authEntryCode: 'iam.login',
      homeCode: 'iam.account',
      nodes: [],
    } as never

    const leaveWorkspace = vi.fn()
    const logout = vi.fn(() => Promise.resolve())
    const { signOut, signingOut } = useSignOut({ logout, leaveWorkspace })

    const pending = signOut()
    expect(signingOut.value).toBe(true)
    await pending

    expect(logout).toHaveBeenCalledOnce()
    expect(leaveWorkspace).toHaveBeenCalledOnce()
    expect(shell.currentUser).toBeNull()
    expect(shell.navigation).toBeNull()
    expect(signingOut.value).toBe(false)
  })

  it('keeps the session and surfaces a toast when logout fails', async () => {
    const shell = useShellStore()
    shell.currentUser = {
      id: '11111111-1111-7111-8111-111111111111',
      tenantId: '22222222-2222-7222-8222-222222222222',
      displayName: '张三',
      avatarUrl: null,
    }

    const leaveWorkspace = vi.fn()
    const logout = vi.fn(() => Promise.reject(new Error('network')))
    const { signOut } = useSignOut({ logout, leaveWorkspace })

    await signOut()

    expect(toast.error).toHaveBeenCalledWith('退出登录失败，请稍后重试')
    expect(leaveWorkspace).not.toHaveBeenCalled()
    expect(shell.currentUser).not.toBeNull()
  })
})
