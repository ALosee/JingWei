import { computed, ref, watch } from 'vue'

import { ApiClientError } from '@jingwei/api-client'

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

/** Positions of the currently selected org unit. */
export function useOrganizationPositions(orgUnitId: () => string) {
  const positions = ref<OrganizationPosition[]>([])
  const busy = ref(false)
  const error = ref('')
  const loadedFor = ref('')

  async function run(action: () => Promise<void>) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      await action()
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      busy.value = false
    }
  }

  async function load(force = false) {
    const id = orgUnitId()
    if (id === '') {
      positions.value = []
      loadedFor.value = ''
      return
    }
    if (!force && loadedFor.value === id) return
    const result = await api.listOrganizationPositions(id)
    if (result.error !== null) throw result.error
    positions.value = result.data.positions
    loadedFor.value = id
  }

  async function reload() {
    await run(async () => {
      await load(true)
    })
  }

  async function createPosition(input: CreateOrganizationPosition) {
    const id = orgUnitId()
    if (id === '') return
    await run(async () => {
      const result = await api.createOrganizationPosition(id, input)
      if (result.error !== null) throw result.error
      positions.value = [...positions.value, result.data]
    })
  }

  async function updatePosition(positionId: string, input: UpdateOrganizationPosition) {
    const id = orgUnitId()
    if (id === '') return
    await run(async () => {
      const result = await api.updateOrganizationPosition(id, positionId, input)
      if (result.error !== null) throw result.error
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
      const result = await api.deleteOrganizationPosition(id, positionId)
      if (result.error !== null) throw result.error
      positions.value = positions.value.filter((item) => item.id !== positionId)
    })
  }

  watch(
    () => orgUnitId(),
    () => {
      void reload()
    },
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
