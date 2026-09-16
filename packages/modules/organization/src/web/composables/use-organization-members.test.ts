// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { ApiClientError, type ApiRequestOptions, type ApiResult } from '@jingwei/api-client'

import type { OrganizationMember } from '../../shared/index.js'
import { useOrganizationMembers } from './use-organization-members.js'

interface PendingList {
  readonly promise: Promise<ApiResult<{ members: OrganizationMember[] }>>
  finish(members: OrganizationMember[]): void
}

function pendingList(options?: ApiRequestOptions): PendingList {
  let resolveRequest: (value: ApiResult<{ members: OrganizationMember[] }>) => void = () =>
    undefined
  options?.onLoadingChange?.(true)
  const promise = new Promise<ApiResult<{ members: OrganizationMember[] }>>((resolve) => {
    resolveRequest = resolve
  })
  return {
    promise,
    finish(members) {
      options?.onLoadingChange?.(false)
      resolveRequest({ data: { members }, error: null })
    },
  }
}

function member(orgUnitId: string, userId: string): OrganizationMember {
  return {
    orgUnitId,
    userId,
    isPrimary: false,
    joinedAt: null,
    user: {
      id: userId,
      username: userId,
      displayName: userId,
      status: 'ACTIVE',
      avatar: null,
    },
    positions: [],
  }
}

describe('useOrganizationMembers', () => {
  it('does not let an earlier organization response overwrite the current selection', async () => {
    const selectedId = ref('org-a')
    const pending = new Map<string, PendingList>()
    const list = vi.fn((id: string, options?: ApiRequestOptions) => {
      const request = pendingList(options)
      pending.set(id, request)
      return request.promise
    })
    const state = useOrganizationMembers(() => selectedId.value, { list })

    selectedId.value = 'org-b'
    await nextTick()
    pending.get('org-a')?.finish([member('org-a', 'user-a')])
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(state.members.value).toEqual([])

    pending.get('org-b')?.finish([member('org-b', 'user-b')])
    await vi.waitFor(() =>
      expect(state.members.value.map((item) => item.userId)).toEqual(['user-b']),
    )
    expect(state.busy.value).toBe(false)
  })

  it('captures directory failures without leaking a rejected fire-and-forget promise', async () => {
    const listCandidates = vi.fn((options?: ApiRequestOptions) => {
      options?.onLoadingChange?.(true)
      options?.onLoadingChange?.(false)
      return Promise.resolve({
        data: null,
        error: new ApiClientError('ORGANIZATION_DIRECTORY_FAILED', '目录不可用', null, 503),
      })
    })
    const state = useOrganizationMembers(() => '', { listCandidates })

    await expect(state.loadDirectory()).resolves.toBeUndefined()
    expect(state.directoryError.value).toBe('目录不可用')
    expect(state.availableUsers.value).toEqual([])
    expect(state.busy.value).toBe(false)
  })
})
