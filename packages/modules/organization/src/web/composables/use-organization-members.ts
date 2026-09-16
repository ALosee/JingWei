import { computed, ref, watch } from 'vue'

import { ApiClientError } from '@jingwei/api-client'
import { useApiRequestState } from '@jingwei/api-client/vue'

import * as api from '../../client/index.js'
import type {
  CreateOrganizationMember,
  OrganizationMember,
  OrganizationPosition,
  UpdateOrganizationMember,
} from '../../shared/index.js'

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiClientError) {
    const requestId = cause.requestId === null ? '' : `\nrequestId: ${cause.requestId}`
    return cause.message + requestId
  }
  return cause instanceof Error ? cause.message : '操作失败'
}

export interface OrganizationMemberDependencies {
  list: typeof api.listOrganizationMembers
  listCandidates: typeof api.listOrganizationMemberCandidates
  create: typeof api.createOrganizationMember
  update: typeof api.updateOrganizationMember
  remove: typeof api.deleteOrganizationMember
  replacePositions: typeof api.replaceOrganizationMemberPositions
}

/** Members of the currently selected org unit. */
export function useOrganizationMembers(
  orgUnitId: () => string,
  dependencies: Partial<OrganizationMemberDependencies> = {},
) {
  const client: OrganizationMemberDependencies = {
    list: api.listOrganizationMembers,
    listCandidates: api.listOrganizationMemberCandidates,
    create: api.createOrganizationMember,
    update: api.updateOrganizationMember,
    remove: api.deleteOrganizationMember,
    replacePositions: api.replaceOrganizationMemberPositions,
    ...dependencies,
  }
  const members = ref<OrganizationMember[]>([])
  const error = ref('')
  const loadedFor = ref('')
  /** Bumps on every org switch so in-flight responses cannot clobber the new unit. */
  const requestGeneration = ref(0)
  const directoryUsers = ref<
    { id: string; username: string; displayName: string; status: string }[]
  >([])
  const directoryError = ref('')
  const listState = useApiRequestState()
  const mutationState = useApiRequestState()
  const directoryState = useApiRequestState()
  const busy = computed(
    () => listState.loading.value || mutationState.loading.value || directoryState.loading.value,
  )
  let operationInFlight = false
  let pendingReload = false

  async function run(action: () => Promise<void>) {
    if (operationInFlight) return
    operationInFlight = true
    error.value = ''
    try {
      await action()
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      operationInFlight = false
      if (pendingReload) {
        pendingReload = false
        void reload()
      }
    }
  }

  async function load(force = false) {
    const id = orgUnitId()
    const generation = requestGeneration.value
    if (id === '') {
      members.value = []
      loadedFor.value = ''
      return
    }
    if (!force && loadedFor.value === id) return
    const result = await client.list(id, listState.options)
    if (generation !== requestGeneration.value || orgUnitId() !== id) return
    if (result.error !== null) throw result.error
    members.value = result.data.members
    loadedFor.value = id
  }

  async function reload() {
    if (operationInFlight) {
      pendingReload = true
      return
    }
    await run(async () => {
      await load(true)
    })
  }

  async function loadDirectory() {
    directoryError.value = ''
    try {
      const result = await client.listCandidates(directoryState.options)
      if (result.error !== null) throw result.error
      directoryUsers.value = result.data.users.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        status: user.status,
      }))
    } catch (cause) {
      directoryUsers.value = []
      directoryError.value = errorMessage(cause)
    }
  }

  function assertCurrentOrg(id: string) {
    if (orgUnitId() !== id || loadedFor.value !== id)
      throw new Error('组织已切换，请重新选择组织后再操作')
  }

  async function addMember(input: CreateOrganizationMember) {
    const id = orgUnitId()
    if (id === '') return
    await run(async () => {
      assertCurrentOrg(id)
      const result = await client.create(id, input, mutationState.options)
      if (result.error !== null) throw result.error
      if (orgUnitId() !== id) return
      members.value = [
        ...members.value.filter((item) => item.userId !== result.data.userId),
        result.data,
      ]
    })
  }

  async function updateMember(userId: string, input: UpdateOrganizationMember) {
    const id = orgUnitId()
    if (id === '') return
    await run(async () => {
      assertCurrentOrg(id)
      const result = await client.update(id, userId, input, mutationState.options)
      if (result.error !== null) throw result.error
      if (orgUnitId() !== id) return
      members.value = members.value.map((item) => (item.userId === userId ? result.data : item))
    })
  }

  async function setPrimary(userId: string, isPrimary: boolean) {
    await updateMember(userId, { isPrimary })
  }

  async function removeMember(userId: string) {
    const id = orgUnitId()
    if (id === '') return
    await run(async () => {
      assertCurrentOrg(id)
      const result = await client.remove(id, userId, mutationState.options)
      if (result.error !== null) throw result.error
      if (orgUnitId() !== id) return
      members.value = members.value.filter((item) => item.userId !== userId)
    })
  }

  async function replacePositions(
    userId: string,
    assignments: { positionId: string; isPrimary?: boolean }[],
    positions: OrganizationPosition[],
  ) {
    const id = orgUnitId()
    if (id === '') return
    await run(async () => {
      assertCurrentOrg(id)
      const result = await client.replacePositions(
        id,
        userId,
        { assignments },
        mutationState.options,
      )
      if (result.error !== null) throw result.error
      if (orgUnitId() !== id) return
      const byId = new Map(positions.map((position) => [position.id, position]))
      members.value = members.value.map((item) => {
        if (item.userId !== userId) return item
        return {
          ...item,
          positions: result.data.positions.map((position) => {
            const fallback = byId.get(position.positionId)
            return {
              positionId: position.positionId,
              code: position.code !== '' ? position.code : (fallback?.code ?? ''),
              name: position.name !== '' ? position.name : (fallback?.name ?? ''),
              isPrimary: position.isPrimary,
            }
          }),
        }
      })
    })
  }

  watch(
    () => orgUnitId(),
    () => {
      requestGeneration.value += 1
      members.value = []
      loadedFor.value = ''
      error.value = ''
      void reload()
    },
    { immediate: true },
  )

  const count = computed(() => members.value.length)
  const availableUsers = computed(() => {
    const existing = new Set(members.value.map((member) => member.userId))
    return directoryUsers.value.filter((user) => !existing.has(user.id) && user.status === 'ACTIVE')
  })

  return {
    members,
    busy,
    error,
    count,
    availableUsers,
    directoryError,
    load,
    reload,
    loadDirectory,
    addMember,
    updateMember,
    setPrimary,
    removeMember,
    replacePositions,
    run,
  }
}
