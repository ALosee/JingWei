import { describe, expect, it } from 'vitest'

import {
  clearIamSessionPermissions,
  hasIamPermission,
  iamSessionPermissions,
  setIamSessionPermissions,
  useIamPermission,
} from './session-permissions.js'

describe('session permissions', () => {
  it('replaces the live set and answers membership checks', () => {
    setIamSessionPermissions(['iam.role.view', 'iam.role.manage'])
    expect(hasIamPermission('iam.role.manage')).toBe(true)
    expect(hasIamPermission('iam.user.manage')).toBe(false)
    expect(useIamPermission('iam.role.view').value).toBe(true)

    clearIamSessionPermissions()
    expect(iamSessionPermissions.value.size).toBe(0)
    expect(hasIamPermission('iam.role.manage')).toBe(false)
  })
})
