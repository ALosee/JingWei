import { computed, ref, watch } from 'vue'

import { ApiClientError } from '@jingwei/api-client'
import { useApiRequestState } from '@jingwei/api-client/vue'

import * as api from '../../client/index.js'
import type {
  CreateOrganizationPosition,
  OrganizationPosition,
  OrganizationUnitStatus,
  UpdateOrganizationPosition,
} from '../../shared/index.js'

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiClientError) {
    const requestId = cause.requestId === null ? '' : `\nrequestId: ${cause.requestId}`
    return cause.message + requestId
  }
  return cause instanceof Error ? cause.message : '操作失败'
}

export interface OrganizationPositionDependencies {
  list: typeof api.listOrganizationPositions
  create: typeof api.createOrganizationPosition
  update: typeof api.updateOrganizationPosition
  remove: typeof api.deleteOrganizationPosition
}

/** Positions of the currently selected org unit. */
export function useOrganizationPositions(
  orgUnitId: () => string,
  dependencies: Partial<OrganizationPositionDependencies> = {},
) {
  const client: OrganizationPositionDependencies = {
    list: api.listOrganizationPositions,
    create: api.createOrganizationPosition,
    update: api.updateOrganizationPosition,
    remove: api.deleteOrganizationPosition,
    ...dependencies,
  }
  const positions = ref<OrganizationPosition[]>([])
  const error = ref('')
  const loadedFor = ref('')
  const requestGeneration = ref(0)
  const listState = useApiRequestState()
  const mutationState = useApiRequestState()
  const busy = computed(() => listState.loading.value || mutationState.loading.value)
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
      positions.value = []
      loadedFor.value = ''
      return
    }
    if (!force && loadedFor.value === id) return
    const result = await client.list(id, listState.options)
    if (generation !== requestGeneration.value || orgUnitId() !== id) return
    if (result.error !== null) throw result.error
    positions.value = result.data.positions
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

  function assertCurrentOrg(id: string) {
    if (orgUnitId() !== id || loadedFor.value !== id)
      throw new Error('组织已切换，请重新选择组织后再操作')
  }

  async function createPosition(input: CreateOrganizationPosition) {
    const id = orgUnitId()
    if (id === '') return
    await run(async () => {
      assertCurrentOrg(id)
      const result = await client.create(id, input, mutationState.options)
      if (result.error !== null) throw result.error
      if (orgUnitId() !== id) return
      positions.value = [...positions.value, result.data]
    })
  }

  async function updatePosition(positionId: string, input: UpdateOrganizationPosition) {
    const id = orgUnitId()
    if (id === '') return
    await run(async () => {
      assertCurrentOrg(id)
      const result = await client.update(id, positionId, input, mutationState.options)
      if (result.error !== null) throw result.error
      if (orgUnitId() !== id) return
      positions.value = positions.value.map((item) => (item.id === positionId ? result.data : item))
    })
  }

  async function setPositionStatus(positionId: string, status: OrganizationUnitStatus) {
    await updatePosition(positionId, { status })
  }

  async function removePosition(positionId: string) {
    const id = orgUnitId()
    if (id === '') return
    await run(async () => {
      assertCurrentOrg(id)
      const result = await client.remove(id, positionId, mutationState.options)
      if (result.error !== null) throw result.error
      if (orgUnitId() !== id) return
      positions.value = positions.value.filter((item) => item.id !== positionId)
    })
  }

  watch(
    () => orgUnitId(),
    () => {
      requestGeneration.value += 1
      positions.value = []
      loadedFor.value = ''
      error.value = ''
      void reload()
    },
    { immediate: true },
  )

  const count = computed(() => positions.value.length)

  return {
    positions,
    busy,
    error,
    count,
    load,
    reload,
    createPosition,
    updatePosition,
    setPositionStatus,
    removePosition,
    run,
  }
}
