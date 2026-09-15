import { computed, onMounted, ref } from 'vue'

import { ApiClientError } from '@jingwei/api-client'

import * as api from '../../client/index.js'
import {
  buildOrganizationTree,
  canMoveOrganizationUnit,
  nextOrganizationSortOrder,
  organizationCreateParentOptions,
  organizationParentOptions,
  type CreateOrganizationUnit,
  type OrganizationUnit,
  type UpdateOrganizationUnit,
} from '../../shared/index.js'

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiClientError) {
    const requestId = cause.requestId === null ? '' : `\nrequestId: ${cause.requestId}`
    return cause.message + requestId
  }
  return cause instanceof Error ? cause.message : '操作失败'
}

/** Page-scoped organization editor: load tree, select node, create/update/delete with gates mirrored in UI. */
export function useOrganizationManagement() {
  const units = ref<OrganizationUnit[]>([])
  const selectedId = ref('')
  const search = ref('')
  const expandedIds = ref<string[]>([])
  const busy = ref(false)
  const error = ref('')
  const creating = ref(false)
  const draftParentId = ref<string | null>(null)

  const selected = computed(() => units.value.find((unit) => unit.id === selectedId.value))
  const tree = computed(() => buildOrganizationTree(units.value))
  const parentOptions = computed(() => {
    // Creating: any unit can be parent. Editing: exclude self and descendants.
    if (creating.value) return organizationCreateParentOptions(units.value)
    if (selected.value === undefined) return organizationCreateParentOptions(units.value)
    return organizationParentOptions(units.value, selected.value.id)
  })
  const selectedHasChildren = computed(() => {
    const id = selectedId.value
    if (id === '') return false
    return units.value.some((unit) => unit.parentId === id)
  })
  const parentPath = computed(() => {
    const byId = new Map(units.value.map((unit) => [unit.id, unit]))
    const path: { id: string; name: string }[] = []
    let cursor = selected.value?.parentId ?? null
    let guard = 0
    while (cursor !== null && guard < 50) {
      const unit = byId.get(cursor)
      if (unit === undefined) break
      path.unshift({ id: unit.id, name: unit.name })
      cursor = unit.parentId
      guard += 1
    }
    return path
  })

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

  async function load() {
    const result = await api.getOrganizationTree()
    if (result.error !== null) throw result.error
    units.value = result.data.units
  }

  function select(id: string) {
    selectedId.value = id
    creating.value = false
  }

  function setExpanded(next: string[]) {
    expandedIds.value = next
  }

  function expandAll() {
    expandedIds.value = units.value.map((unit) => unit.id)
  }

  function collapseAll() {
    expandedIds.value = []
  }

  function beginCreateRoot() {
    creating.value = true
    draftParentId.value = null
  }

  function beginCreateChild(parentId: string) {
    creating.value = true
    draftParentId.value = parentId
    if (!expandedIds.value.includes(parentId)) {
      expandedIds.value = [...expandedIds.value, parentId]
    }
  }

  function cancelCreate() {
    creating.value = false
    draftParentId.value = null
  }

  async function createUnit(input: CreateOrganizationUnit) {
    await run(async () => {
      const result = await api.createOrganizationUnit(input)
      if (result.error !== null) throw result.error
      units.value = [...units.value, result.data]
      selectedId.value = result.data.id
      if (result.data.parentId !== null && !expandedIds.value.includes(result.data.parentId)) {
        expandedIds.value = [...expandedIds.value, result.data.parentId]
      }
      creating.value = false
      draftParentId.value = null
    })
  }

  async function updateUnit(id: string, input: UpdateOrganizationUnit) {
    await run(async () => {
      const result = await api.updateOrganizationUnit(id, input)
      if (result.error !== null) throw result.error
      units.value = units.value.map((unit) => (unit.id === id ? result.data : unit))
    })
  }

  async function removeUnit(id: string) {
    await run(async () => {
      const result = await api.deleteOrganizationUnit(id)
      if (result.error !== null) throw result.error
      units.value = units.value.filter((unit) => unit.id !== id)
      if (selectedId.value === id) selectedId.value = ''
    })
  }

  async function moveUnit(id: string, parentId: string | null) {
    if (!canMoveOrganizationUnit(units.value, id, parentId)) {
      error.value = '不能将组织移动到自身或其下级'
      return
    }
    await updateUnit(id, { parentId })
  }

  function suggestSortOrder(parentId: string | null) {
    return nextOrganizationSortOrder(units.value, parentId)
  }

  onMounted(() => {
    void run(async () => {
      await load()
      const first = units.value[0]
      if (first !== undefined) {
        selectedId.value = first.id
        const parents: string[] = []
        for (const unit of units.value) {
          if (unit.parentId !== null && !parents.includes(unit.parentId)) {
            parents.push(unit.parentId)
          }
        }
        expandedIds.value = parents
      }
    })
  })

  return {
    units,
    tree,
    selected,
    selectedId,
    selectedHasChildren,
    parentPath,
    parentOptions,
    search,
    expandedIds,
    busy,
    error,
    creating,
    draftParentId,
    load,
    select,
    setExpanded,
    expandAll,
    collapseAll,
    beginCreateRoot,
    beginCreateChild,
    cancelCreate,
    createUnit,
    updateUnit,
    removeUnit,
    moveUnit,
    suggestSortOrder,
    run,
  }
}
