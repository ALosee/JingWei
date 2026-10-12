import { ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { PageTabsOptionData } from '@jingwei/ui'

/** The shell renders tabs; the host owns concrete locations and close policy. */
export function useWorkspaceTabs() {
  const route = useRoute()
  const router = useRouter()
  const items: Ref<PageTabsOptionData[]> = ref([])
  const fullPaths = new Map<string, string>()
  const activeValue = ref('')

  watch(
    () => route.fullPath,
    () => {
      const path = route.path
      const label =
        typeof route.meta.title === 'string' && route.meta.title !== ''
          ? route.meta.title
          : typeof route.name === 'string'
            ? route.name
            : path
      fullPaths.set(path, route.fullPath)
      const index = items.value.findIndex((item) => item.value === path)
      const next: PageTabsOptionData = {
        value: path,
        label,
        hidePinnedIcon: true,
        draggable: false,
      }
      if (index >= 0) items.value[index] = next
      else items.value.push(next)
      activeValue.value = path
    },
    { immediate: true },
  )

  watch(activeValue, async (path) => {
    if (path === '' || path === route.path) return
    const target = fullPaths.get(path) ?? path
    const failure = await router.push(target)
    if (failure) activeValue.value = route.path
  })

  function beforeClose(): boolean {
    return items.value.length > 1
  }
  function onClose(tab: PageTabsOptionData): void {
    fullPaths.delete(tab.value)
  }

  return { items, activeValue, beforeClose, onClose }
}
