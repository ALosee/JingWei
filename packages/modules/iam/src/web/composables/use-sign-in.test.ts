import { expect, it, vi } from 'vitest'

import { useSignIn } from './use-sign-in.js'

it('enters the workspace only after login completes', async () => {
  const login = vi.fn(() =>
    Promise.resolve({
      user: { id: 'user', tenantId: 'tenant', displayName: 'Test' },
      csrfToken: 'test',
    }),
  )
  const enterWorkspace = vi.fn()
  const form = useSignIn({ login, enterWorkspace })
  form.username.value = 'admin'
  form.password.value = 'test-password'
  await form.submit()
  expect(login).toHaveBeenCalledWith({
    tenantCode: 'default',
    login: 'admin',
    password: 'test-password',
  })
  expect(enterWorkspace).toHaveBeenCalledOnce()
  expect(form.submitting.value).toBe(false)
})

it('retains a readable error and resets submitting on authentication failure', async () => {
  const enterWorkspace = vi.fn()
  const form = useSignIn({
    login: () => Promise.reject(new Error('Invalid credentials')),
    enterWorkspace,
  })
  await form.submit()
  expect(form.errorMessage.value).toBe('Invalid credentials')
  expect(form.submitting.value).toBe(false)
  expect(enterWorkspace).not.toHaveBeenCalled()
})
