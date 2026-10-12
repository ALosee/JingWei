import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { navigationTarget } from '@jingwei/module-navigation/shared'
import type { AppShellMenuProps } from '@jingwei/ui'

import { createAppShellItems } from '../../navigation/app-shell-items.js'
import { navigationBreadcrumbs } from '../../navigation/presentation.js'
import { useShellStore } from '../../stores/shell.js'

export function useWorkspaceNavigation() {
  const shell = useShellStore()
  const route = useRoute()
  const mobileOpen = ref(false)
  const pageExpanded = ref<string[]>([])
  const items = computed(() => createAppShellItems(shell.navigation?.nodes ?? []))
  const activeValue = computed(() =>
    typeof route.meta.navigationCode === 'string' ? route.meta.navigationCode : '',
  )
  const currentIsPage = computed(
    () => shell.navigation?.nodes.find((node) => node.code === activeValue.value)?.type === 'PAGE',
  )

  // TreeMenu excludes hidden entries before expansion. Use its controlled
  // expansion API on PAGE routes while keeping AppShell's full breadcrumb trail.
  const menuProps = computed<AppShellMenuProps>(() => {
    const tree = {
      ...(currentIsPage.value
        ? { expanded: pageExpanded.value, expandStrategy: 'keep' as const }
        : {}),
      'onUpdate:expanded': (values: string[]) => {
        pageExpanded.value = values
      },
      'aria-label': '主导航',
    }
    const treeNav = {
      trigger: 'hover' as const,
      delayDuration: 150,
      skipDelayDuration: 300,
      collapsible: true,
      moreLabel: '更多',
      moreIcon: 'lucide:ellipsis',
      'aria-label': '顶部导航',
    }
    return { tree, treeNav }
  })

  watch(
    () => route.fullPath,
    () => {
      mobileOpen.value = false
      pageExpanded.value = navigationBreadcrumbs(shell.navigation?.nodes ?? [], activeValue.value)
        .filter((node) => node.type === 'DIRECTORY' || node.type === 'MENU')
        .map((node) => node.code)
    },
    { immediate: true },
  )

  function onSelect(code: string): void {
    const node = shell.navigation?.nodes.find((item) => item.code === code)
    if (
      node?.type === 'EXTERNAL_LINK' ||
      (node?.type === 'MENU' && navigationTarget(node) === route.fullPath)
    ) {
      mobileOpen.value = false
    }
  }

  return { items, activeValue, mobileOpen, menuProps, onSelect }
}
