import { expect, it, vi } from 'vitest'

import type { ApiRequestOptions } from '@jingwei/api-client'

import type { LoginInput } from '../../shared/index.js'
import { useSignIn } from './use-sign-in.js'

it('derives submitting state from the HTTP request lifecycle', async () => {
  let finishLogin = () => undefined
  const login = vi.fn(
    (_input: LoginInput, options: ApiRequestOptions): Promise<{ error: null }> => {
      options.onLoadingChange?.(true)
      return new Promise((resolve) => {
        finishLogin = () => {
          options.onLoadingChange?.(false)
          resolve({ error: null })
        }
      })
    },
  )
  const enterWorkspace = vi.fn()
  const form = useSignIn({ login, enterWorkspace })
  form.username.value = 'admin'
  form.password.value = 'test-password'
  const submission = form.submit()

  expect(form.submitting.value).toBe(true)
  await form.submit()
  expect(login).toHaveBeenCalledOnce()
  expect(login.mock.calls[0]?.[0]).toEqual({
    tenantCode: 'default',
    login: 'admin',
    password: 'test-password',
  })
  expect(typeof login.mock.calls[0]?.[1].onLoadingChange).toBe('function')
  finishLogin()
  await submission

  expect(enterWorkspace).toHaveBeenCalledOnce()
  expect(form.submitting.value).toBe(false)
})

it('renders a flat login error without exception control flow', async () => {
  const enterWorkspace = vi.fn()
  const form = useSignIn({
    login: (_input, options) => {
      options.onLoadingChange?.(true)
      options.onLoadingChange?.(false)
      return Promise.resolve({ error: new Error('Invalid credentials') })
    },
    enterWorkspace,
  })
  await form.submit()
  expect(form.errorMessage.value).toBe('Invalid credentials')
  expect(form.submitting.value).toBe(false)
  expect(enterWorkspace).not.toHaveBeenCalled()
})
