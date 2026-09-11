// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

import { useChangePassword } from './use-change-password.js'

describe('useChangePassword', () => {
  it('submits matching passwords and leaves the workspace on success', async () => {
    const change = vi.fn(() => Promise.resolve({ data: undefined, error: null }))
    const leaveWorkspace = vi.fn()
    const form = useChangePassword({ change, leaveWorkspace })

    form.currentPassword.value = 'old-password'
    form.newPassword.value = 'new-password'
    form.confirmPassword.value = 'new-password'
    await form.submit()

    expect(change).toHaveBeenCalledWith(
      { currentPassword: 'old-password', newPassword: 'new-password' },
      expect.anything(),
    )
    expect(leaveWorkspace).toHaveBeenCalledOnce()
  })

  it('rejects mismatched confirmation without calling the API', async () => {
    const change = vi.fn(() => Promise.resolve({ data: undefined, error: null }))
    const form = useChangePassword({ change, leaveWorkspace: vi.fn() })

    form.currentPassword.value = 'old-password'
    form.newPassword.value = 'new-password'
    form.confirmPassword.value = 'different'
    await form.submit()

    expect(change).not.toHaveBeenCalled()
    expect(form.errorMessage.value).toBe('两次输入的新密码不一致')
  })
})
