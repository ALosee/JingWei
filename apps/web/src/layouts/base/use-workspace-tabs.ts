import { computed, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { PageTabsOptionData, PageTabsProps } from '@jingwei/ui'

import { resolveHomeTarget } from '../../navigation/workspace-targets.js'
import { useShellStore } from '../../stores/shell.js'
import {
  readWorkspaceTabSession,
  resolveWorkspaceTab,
  workspaceTabSessionKey,
  writeWorkspaceTabSession,
  type SavedWorkspaceTab,
  type WorkspaceTabLocation,
} from './workspace-tab-session.js'

/** The shell renders tabs; the host owns concrete locations and close policy. */
export function useWorkspaceTabs() {
  const route = useRoute()
  const router = useRouter()
  const shell = useShellStore()
  const items: Ref<PageTabsOptionData[]> = ref([])
  const locations = new Map<string, WorkspaceTabLocation>()
  const activeValue = ref('')
  let homeValue = ''
  let homeUserPinned = false
  let loadedScopeKey: string | null = null
  const scopeKey = computed(() =>
    shell.currentUser === null
      ? null
      : workspaceTabSessionKey(shell.currentUser.tenantId, shell.currentUser.id),
  )

  const home = computed(() => {
    if (shell.navigation === null) return null
    return resolveWorkspaceTab(resolveHomeTarget(shell.navigation), router, shell.navigation)
  })

  function snapshot(): SavedWorkspaceTab[] {
    return items.value.flatMap((item) => {
      const location = locations.get(item.value)
      // The home is pinned by current navigation, rather than by the user's saved preference.
      return location
        ? [
            {
              ...location,
              pinned: item.value === homeValue ? homeUserPinned : item.pinned === true,
            },
          ]
        : []
    })
  }

  function persist(): void {
    if (loadedScopeKey === scopeKey.value) writeWorkspaceTabSession(loadedScopeKey, snapshot())
  }

  function restore(): void {
    const key = scopeKey.value
    const previous = snapshot()
    const changedScope = key !== loadedScopeKey
    if (changedScope) writeWorkspaceTabSession(loadedScopeKey, previous)
    const saved = changedScope ? readWorkspaceTabSession(key) : previous
    items.value = []
    locations.clear()
    for (const entry of saved) {
      const tab = resolveWorkspaceTab(entry.fullPath, router, shell.navigation)
      if (tab === null) continue
      if (
        tab.location.navigationCode !== entry.navigationCode ||
        tab.location.routeKey !== entry.routeKey ||
        locations.has(tab.item.value)
      )
        continue
      items.value.push({ ...tab.item, pinned: entry.pinned, draggable: true })
      locations.set(tab.item.value, tab.location)
    }
    items.value.sort((left, right) => Number(right.pinned === true) - Number(left.pinned === true))
    const nextHome = home.value
    homeValue = nextHome?.item.value ?? ''
    homeUserPinned = items.value.find((item) => item.value === homeValue)?.pinned === true
    if (nextHome) {
      const index = items.value.findIndex((item) => item.value === homeValue)
      if (index >= 0) items.value.splice(index, 1)
      items.value.unshift({ ...nextHome.item, pinned: true, draggable: false })
      if (!locations.has(homeValue)) locations.set(homeValue, nextHome.location)
    }
    loadedScopeKey = key
    syncCurrentRoute()
    persist()
  }

  function syncCurrentRoute(): void {
    const tab = resolveWorkspaceTab(route.fullPath, router, shell.navigation)
    if (tab === null) {
      activeValue.value = ''
      return
    }
    locations.set(tab.item.value, tab.location)
    const existing = items.value.find((item) => item.value === tab.item.value)
    if (existing) existing.label = tab.item.label
    else items.value.push(tab.item)
    activeValue.value = tab.item.value
  }

  watch([scopeKey, () => shell.navigation], restore, { immediate: true })
  watch(
    () => route.fullPath,
    () => {
      syncCurrentRoute()
      persist()
    },
  )

  watch(activeValue, async (path) => {
    if (path === '' || path === route.path) return
    const target = locations.get(path)?.fullPath ?? path
    const failure = await router.push(target)
    if (failure) syncCurrentRoute()
  })

  // Native bulk actions replace the array without emitting individual close events.
  watch(
    () => items.value.map((item) => ({ value: item.value, pinned: item.pinned })),
    (values) => {
      const remaining = new Set(values.map((item) => item.value))
      for (const path of locations.keys()) {
        if (!remaining.has(path)) locations.delete(path)
      }
      persist()
    },
  )

  function beforeClose(value: string): boolean {
    return items.value.length > 1 && !items.value.find((item) => item.value === value)?.pinned
  }

  const menuFactory: NonNullable<PageTabsProps['menuFactory']> = (tab, state) => [
    {
      value: 'close',
      label: '关闭',
      icon: 'lucide:x',
      disabled: !state.closable,
      action: state.close,
    },
    {
      value: 'closeOther',
      label: '关闭其他',
      disabled: !state.otherClosable,
      action: state.closeOther,
    },
    {
      value: 'closeLeft',
      label: '关闭左侧',
      disabled: !state.leftClosable,
      action: state.closeLeft,
    },
    {
      value: 'closeRight',
      label: '关闭右侧',
      disabled: !state.rightClosable,
      action: state.closeRight,
    },
    {
      value: 'closeAll',
      label: '关闭所有',
      disabled: !state.allClosable,
      action: state.closeAll,
      separator: true,
    },
    {
      value: tab.pinned ? 'unpin' : 'pin',
      label: tab.pinned ? '取消固定' : '固定',
      icon: tab.pinned ? 'lucide:pin-off' : 'lucide:pin',
      disabled: tab.value === homeValue,
      action: tab.pinned ? state.unpin : state.pin,
    },
  ]

  return { items, activeValue, beforeClose, menuFactory }
}
