import { computed, ref, type Ref } from 'vue'

import {
  isContainer,
  isInternal,
  paramsSchema,
  querySchema,
  type NavigationCatalog,
  type NavigationNode,
  type NavigationNodeType,
  type NavigationVersion,
} from '../../shared/index.js'
import {
  buildNavigationTree,
  canNestNode,
  defaultExpandedIds,
  flattenNavigationTree,
  nextSortOrder,
  parentOptionsFor,
  uniqueCode,
} from './navigation-tree.js'
import type { NavigationFeedback } from './use-navigation-feedback.js'

/** Local editing only: no HTTP, publish, role grants, or global store mutations. */
export function useNavigationEditor(
  catalog: Ref<NavigationCatalog>,
  feedback: NavigationFeedback,
  confirm: (message: string) => boolean,
) {
  const { busy, error } = feedback
  const version = ref<NavigationVersion | null>(null)
  const selectedId = ref('')
  const selected = computed(() => version.value?.nodes.find((node) => node.id === selectedId.value))
  const dirty = ref(false)
  const paramsText = ref('{}')
  const queryText = ref('{}')
  const search = ref('')
  const expandedIds = ref<Set<string>>(new Set())
  const highlightId = ref('')
  const readOnly = computed(() => version.value?.status !== 'DRAFT' || busy.value)

  const tree = computed(() => buildNavigationTree(version.value?.nodes ?? []))
  const rows = computed(() => flattenNavigationTree(tree.value, expandedIds.value, search.value))
  const parentOptions = computed(() =>
    selected.value === undefined
      ? []
      : parentOptionsFor(version.value?.nodes ?? [], selected.value),
  )

  function selectNode(id: string) {
    // Preserve edits to JSON fields before moving to another node.
    if (selected.value !== undefined && dirty.value) {
      try {
        applyJson()
      } catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'JSON 无效'
        return
      }
    }
    selectedId.value = id
    paramsText.value = JSON.stringify(selected.value?.params ?? {}, null, 2)
    queryText.value = JSON.stringify(selected.value?.query ?? {}, null, 2)
  }
  function applyJson() {
    if (selected.value === undefined) return
    const params: unknown = JSON.parse(paramsText.value)
    const query: unknown = JSON.parse(queryText.value)
    selected.value.params = paramsSchema.parse(params)
    selected.value.query = querySchema.parse(query)
  }
  function changeType(nextType?: NavigationNodeType) {
    const node = selected.value
    if (node === undefined) return
    if (nextType !== undefined) node.type = nextType
    if (!isInternal(node)) {
      node.routeKey = null
      node.path = null
      node.layout = null
      node.params = {}
      node.query = {}
      paramsText.value = '{}'
      queryText.value = '{}'
    }
    if (isContainer(node)) {
      node.accessMode = null
      node.href = null
      node.externalTarget = null
    } else if (node.type === 'EXTERNAL_LINK') {
      node.accessMode = 'AUTHENTICATED'
      node.href = ''
      node.externalTarget = 'BLANK'
    } else {
      node.href = null
      node.externalTarget = null
      node.layout = 'base'
      node.accessMode = 'PERMISSION'
    }
    dirty.value = true
  }
  function changeRoute(nextRouteKey?: string | null) {
    const node = selected.value
    if (node === undefined) return
    if (nextRouteKey !== undefined) node.routeKey = nextRouteKey
    const definition = catalog.value.routes.find((route) => route.key === node.routeKey)
    if (definition !== undefined) {
      node.layout = definition.layout
      node.accessMode = definition.allowedAccessModes[0] ?? 'PERMISSION'
    }
    dirty.value = true
  }
  function createNodePayload(type: NavigationNodeType, parentId: string | null): NavigationNode {
    const nodes = version.value?.nodes ?? []
    return {
      id: crypto.randomUUID(),
      code: uniqueCode(nodes, 'new-node'),
      name: '新节点',
      type,
      status: 'ENABLED',
      parentId,
      routeKey: null,
      path: type === 'MENU' || type === 'PAGE' ? '' : null,
      layout: type === 'MENU' || type === 'PAGE' ? 'base' : null,
      accessMode:
        type === 'DIRECTORY' || type === 'GROUP'
          ? null
          : type === 'EXTERNAL_LINK'
            ? 'AUTHENTICATED'
            : 'PERMISSION',
      icon: null,
      sortOrder: nextSortOrder(nodes, parentId),
      href: type === 'EXTERNAL_LINK' ? '' : null,
      externalTarget: type === 'EXTERNAL_LINK' ? 'BLANK' : null,
      params: {},
      query: {},
    }
  }
  function insertNode(node: NavigationNode) {
    if (version.value === null) return
    version.value.nodes.push(node)
    if (node.parentId !== null) expandedIds.value.add(node.parentId)
    selectNode(node.id)
    dirty.value = true
  }
  function addNode() {
    const parentId =
      selected.value !== undefined && isContainer(selected.value) ? selected.value.id : null
    insertNode(createNodePayload('MENU', parentId))
  }
  function addNodeAs(type: NavigationNodeType) {
    const parentId =
      selected.value !== undefined && isContainer(selected.value) ? selected.value.id : null
    insertNode(createNodePayload(type, parentId))
  }
  function addSiblingNode() {
    insertNode(createNodePayload('MENU', selected.value?.parentId ?? null))
  }
  function removeNode() {
    if (version.value === null || selected.value === undefined) return
    if (version.value.nodes.some((node) => node.parentId === selectedId.value)) {
      error.value = '请先移动或删除子节点'
      return
    }
    if (!confirm('从草稿中删除此节点？已发布版本不会变化。')) return
    version.value.nodes = version.value.nodes.filter((node) => node.id !== selectedId.value)
    selectedId.value = ''
    dirty.value = true
  }
  function moveNode(delta: -1 | 1) {
    if (version.value === null || selected.value === undefined || readOnly.value) return
    const node = selected.value
    const siblings = version.value.nodes
      .filter((item) => item.parentId === node.parentId)
      .toSorted(
        (left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code),
      )
    const index = siblings.findIndex((item) => item.id === node.id)
    const target = siblings[index + delta]
    if (target === undefined) return
    const left = delta === -1 ? target : node
    const right = delta === -1 ? node : target
    if (left.sortOrder === right.sortOrder) right.sortOrder += 1
    const temp = left.sortOrder
    left.sortOrder = right.sortOrder
    right.sortOrder = temp
    dirty.value = true
  }
  function moveNodeToParent(parentId: string | null) {
    if (version.value === null || selected.value === undefined || readOnly.value) return
    if (!canNestNode(version.value.nodes, selected.value.id, parentId)) {
      error.value = '目标父节点不接受该节点类型'
      return
    }
    selected.value.parentId = parentId
    selected.value.sortOrder = nextSortOrder(
      version.value.nodes.filter((node) => node.id !== selected.value?.id),
      parentId,
    )
    if (parentId !== null) expandedIds.value.add(parentId)
    dirty.value = true
  }
  function toggleExpanded(id: string) {
    const next = new Set(expandedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    expandedIds.value = next
  }
  function expandAll() {
    const ids = new Set<string>()
    for (const node of version.value?.nodes ?? []) {
      if (version.value?.nodes.some((child) => child.parentId === node.id)) ids.add(node.id)
    }
    expandedIds.value = ids
  }
  function collapseAll() {
    expandedIds.value = new Set()
  }
  function revealNode(id: string) {
    const nodes = version.value?.nodes ?? []
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const next = new Set(expandedIds.value)
    let cursor = byId.get(id)?.parentId ?? null
    while (cursor !== null) {
      next.add(cursor)
      cursor = byId.get(cursor)?.parentId ?? null
    }
    expandedIds.value = next
    highlightId.value = id
    selectNode(id)
  }
  function replaceVersion(value: NavigationVersion, selectedCode?: string) {
    version.value = value
    dirty.value = false
    search.value = ''
    highlightId.value = ''
    expandedIds.value = defaultExpandedIds(value.nodes)
    selectNode(
      value.nodes.find((node) => node.code === selectedCode)?.id ?? value.nodes[0]?.id ?? '',
    )
  }
  return {
    version,
    selectedId,
    selected,
    dirty,
    paramsText,
    queryText,
    search,
    expandedIds,
    highlightId,
    readOnly,
    tree,
    rows,
    parentOptions,
    selectNode,
    applyJson,
    changeType,
    changeRoute,
    addNode,
    addNodeAs,
    addSiblingNode,
    removeNode,
    moveNode,
    moveNodeToParent,
    toggleExpanded,
    expandAll,
    collapseAll,
    revealNode,
    replaceVersion,
  }
}
export type NavigationEditor = ReturnType<typeof useNavigationEditor>
