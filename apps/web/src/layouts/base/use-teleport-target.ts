import { useMutationObserver } from '@vueuse/core'
import { onMounted, shallowRef, type ShallowRef } from 'vue'

export function useTeleportTarget(id: string): ShallowRef<HTMLElement | null> {
  const target = shallowRef<HTMLElement | null>(null)

  function resolveTarget(): void {
    target.value = typeof document === 'undefined' ? null : document.getElementById(id)
  }

  onMounted(resolveTarget)
  useMutationObserver(
    () => (typeof document === 'undefined' ? null : document.body),
    resolveTarget,
    { childList: true, subtree: true },
  )

  return target
}
