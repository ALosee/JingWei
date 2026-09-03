import { computed, ref, type Ref } from 'vue'
import {
  isContainer, isInternal, paramsSchema, querySchema,
  type NavigationCatalog, type NavigationNode, type NavigationVersion
} from '../../shared/index.js'
import type { NavigationFeedback } from './use-navigation-feedback.js'

/** Local editing only: no HTTP, publish, role grants, or global store mutations. */
export function useNavigationEditor(catalog: Ref<NavigationCatalog>, feedback: NavigationFeedback, confirm: (message: string) => boolean) {
  const { busy, error } = feedback
  const version = ref<NavigationVersion | null>(null)
  const selectedId = ref('')
  const selected = computed(() => version.value?.nodes.find((node) => node.id === selectedId.value))
  const dirty = ref(false)
  const paramsText = ref('{}')
  const queryText = ref('{}')
  const readOnly = computed(() => version.value?.status !== 'DRAFT' || busy.value)
  function selectNode(id: string) {
    // Preserve edits to JSON fields before moving to another node.
    if (selected.value !== undefined && dirty.value) {
      try { applyJson() } catch (cause) { error.value = cause instanceof Error ? cause.message : 'JSON 无效'; return }
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
  function changeType() {
    const node = selected.value
    if (node === undefined) return
    if (!isInternal(node)) {
      node.routeKey = null; node.path = null; node.layout = null; node.params = {}; node.query = {}
      paramsText.value = '{}'; queryText.value = '{}'
    }
    if (isContainer(node)) { node.accessMode = null; node.href = null; node.externalTarget = null }
    else if (node.type === 'EXTERNAL_LINK') { node.accessMode = 'AUTHENTICATED'; node.href = ''; node.externalTarget = 'BLANK' }
    else { node.href = null; node.externalTarget = null; node.layout = 'base'; node.accessMode = 'PERMISSION' }
  }
  function changeRoute() {
    const node = selected.value
    const definition = catalog.value.routes.find((route) => route.key === node?.routeKey)
    if (node !== undefined && definition !== undefined) {
      node.layout = definition.layout
      node.accessMode = definition.allowedAccessModes[0] ?? 'PERMISSION'
    }
  }
  function addNode() {
    if (version.value === null) return
    const node: NavigationNode = {
      id: crypto.randomUUID(), code: 'new-node-' + String(version.value.nodes.length + 1), name: '新节点',
      type: 'MENU', status: 'ENABLED', parentId: null, routeKey: null, path: '', layout: 'base',
      accessMode: 'PERMISSION', icon: null, sortOrder: 0, href: null, externalTarget: null, params: {}, query: {},
    }
    version.value.nodes.push(node)
    selectNode(node.id)
    dirty.value = true
  }
  function removeNode() {
    if (version.value === null || selected.value === undefined) return
    if (version.value.nodes.some((node) => node.parentId === selectedId.value)) { error.value = '请先移动或删除子节点'; return }
    if (!confirm('从草稿中删除此节点？已发布版本不会变化。')) return
    version.value.nodes = version.value.nodes.filter((node) => node.id !== selectedId.value)
    selectedId.value = ''
    dirty.value = true
  }
  function replaceVersion(value: NavigationVersion, selectedCode?: string) {
    version.value = value
    dirty.value = false
    selectNode(value.nodes.find((node) => node.code === selectedCode)?.id ?? value.nodes[0]?.id ?? '')
  }
  return {
    version, selectedId, selected, dirty, paramsText, queryText, readOnly,
    selectNode, applyJson, changeType, changeRoute, addNode, removeNode, replaceVersion
  }
}
export type NavigationEditor = ReturnType<typeof useNavigationEditor>
