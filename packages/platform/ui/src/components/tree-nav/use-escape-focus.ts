import { onUnmounted, type HTMLAttributes } from 'vue'

/** Follow popup ARIA ownership through submenus to the owning navigation trigger. */
function navigationTrigger(popup: HTMLElement): HTMLElement | null {
  const visited = new Set<HTMLElement>()
  let current: HTMLElement | null = popup
  while (current !== null && !visited.has(current)) {
    visited.add(current)
    const labelId: string | null = current.getAttribute('aria-labelledby')
    const trigger: HTMLElement | null = labelId === null ? null : document.getElementById(labelId)
    if (trigger === null) return null
    if (trigger.closest('[data-vean-tree-nav]') !== null) return trigger
    current = trigger.closest<HTMLElement>('[role="menu"]')
  }
  return null
}

/** Restore keyboard focus after an Escape dismissal in a non-modal hover popup. */
export function useTreeNavEscapeFocus() {
  let frame: number | undefined
  onUnmounted(() => {
    if (frame !== undefined) cancelAnimationFrame(frame)
  })

  return (original?: HTMLAttributes['onKeydown']) =>
    (event: KeyboardEvent): void => {
      original?.(event)
      if (event.key !== 'Escape' || !(event.target instanceof HTMLElement)) return
      const popup = event.target.closest<HTMLElement>('[role="menu"]')
      if (popup === null) return
      const trigger = navigationTrigger(popup)
      if (trigger === null) return
      if (frame !== undefined) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = undefined
        if (!trigger.isConnected || trigger.getAttribute('aria-expanded') !== 'false') return
        const active = document.activeElement
        // Preserve a deliberate focus move to another trigger or control.
        if (active !== null && active !== document.body && !popup.contains(active)) return
        trigger.focus({ preventScroll: true })
      })
    }
}
