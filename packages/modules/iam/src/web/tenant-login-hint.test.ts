// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'

import {
  currentTenantLoginHint,
  rememberedTenantSignInPath,
  rememberSuccessfulTenantCode,
  selectTenantLoginHint,
} from './tenant-login-hint.js'

describe('tenant login hint', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createMemoryStorage(),
    })
    window.history.replaceState(null, '', '/signin')
  })

  it('prefers a valid explicit URL tenant over stored and fallback values', () => {
    expect(selectTenantLoginHint('?tenantCode= HUNAN ', 'previous', 'default')).toBe('hunan')
  })

  it('uses the last successful tenant and finally the configured fallback', () => {
    expect(selectTenantLoginHint('', 'hunanzhonghang', 'default')).toBe('hunanzhonghang')
    expect(selectTenantLoginHint('?tenantCode=invalid_code', null, 'default')).toBe('default')
  })

  it('persists only valid normalized tenant codes for the next login', () => {
    rememberSuccessfulTenantCode(' HunanZhonghang ')
    expect(currentTenantLoginHint()).toBe('hunanzhonghang')
    expect(rememberedTenantSignInPath()).toBe('/signin?tenantCode=hunanzhonghang')

    rememberSuccessfulTenantCode('invalid_code')
    expect(currentTenantLoginHint()).toBe('hunanzhonghang')
  })

  it('lets an explicit login URL override the remembered tenant without overwriting it', () => {
    rememberSuccessfulTenantCode('hunanzhonghang')
    window.history.replaceState(null, '', '/signin?tenantCode=beijing')

    expect(currentTenantLoginHint()).toBe('beijing')

    window.history.replaceState(null, '', '/signin')
    expect(currentTenantLoginHint()).toBe('hunanzhonghang')
  })
})

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}
