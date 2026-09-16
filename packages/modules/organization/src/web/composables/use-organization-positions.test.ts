// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { ApiRequestOptions, ApiResult } from '@jingwei/api-client'

import type { OrganizationPosition } from '../../shared/index.js'
import { useOrganizationPositions } from './use-organization-positions.js'

interface PendingList {
  readonly promise: Promise<ApiResult<{ positions: OrganizationPosition[] }>>
  finish(positions: OrganizationPosition[]): void
}

function pendingList(options?: ApiRequestOptions): PendingList {
  let resolveRequest: (value: ApiResult<{ positions: OrganizationPosition[] }>) => void = () =>
    undefined
  options?.onLoadingChange?.(true)
  const promise = new Promise<ApiResult<{ positions: OrganizationPosition[] }>>((resolve) => {
    resolveRequest = resolve
  })
  return {
    promise,
    finish(positions) {
      options?.onLoadingChange?.(false)
      resolveRequest({ data: { positions }, error: null })
    },
  }
}

function position(orgUnitId: string, code: string): OrganizationPosition {
  return {
    id: `${code}00000-0000-4000-8000-000000000000`.slice(0, 36),
    orgUnitId,
    code,
    name: code,
    status: 'ENABLED',
    sortOrder: 0,
  }
}

describe('useOrganizationPositions', () => {
  it('ignores a stale response and reloads the newly selected organization', async () => {
    const selectedId = ref('org-a')
    const pending = new Map<string, PendingList>()
    const list = vi.fn((id: string, options?: ApiRequestOptions) => {
      const request = pendingList(options)
      pending.set(id, request)
      return request.promise
    })
    const state = useOrganizationPositions(() => selectedId.value, { list })

    expect(list).toHaveBeenCalledWith('org-a', expect.anything())
    expect(state.busy.value).toBe(true)
    selectedId.value = 'org-b'
    await nextTick()

    pending.get('org-a')?.finish([position('org-a', 'A')])
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(state.positions.value).toEqual([])

    pending.get('org-b')?.finish([position('org-b', 'B')])
    await vi.waitFor(() => expect(state.positions.value.map((item) => item.code)).toEqual(['B']))
    expect(state.busy.value).toBe(false)
  })
})
