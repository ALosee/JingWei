import type { VNode } from 'vue'
import { nextTick } from 'vue'

/** Preserve a keyed item's focus when upstream motion reparents its DOM node. */
export function useTreeMotionFocus() {
  let focusedValue: string | null = null
  let restorePending = false

  function onFocusIn(event: FocusEvent): void {
    const target = event.target
    focusedValue =
      target instanceof HTMLElement && target.matches('[data-vean-tree-item]')
        ? target.getAttribute('data-vean-tree-value')
        : null
  }

  function onFocusOut(event: FocusEvent): void {
    const root = event.currentTarget
    const next = event.relatedTarget
    if (!(root instanceof HTMLElement)) return
    if (next instanceof Node && !root.contains(next)) focusedValue = null
  }

  function beforeUpdate(vnode: VNode): void {
    const root = vnode.el
    if (!(root instanceof HTMLElement)) return
    const active = root.ownerDocument.activeElement
    if (
      active instanceof HTMLElement &&
      root.contains(active) &&
      active.matches('[data-vean-tree-item]')
    ) {
      focusedValue = active.getAttribute('data-vean-tree-value')
    }
  }

  function afterUpdate(vnode: VNode): void {
    const root = vnode.el
    if (focusedValue === null || restorePending || !(root instanceof HTMLElement)) return
    restorePending = true
    // Motion may trigger another patch in the same flush; restore after both settle.
    void nextTick(() => {
      restorePending = false
      const value = focusedValue
      if (value === null || !root.isConnected) return
      const document = root.ownerDocument
      // An explicit move to another control always wins over motion focus restoration.
      if (document.activeElement !== document.body && document.activeElement !== null) return
      const item = Array.from(root.querySelectorAll<HTMLElement>('[data-vean-tree-value]')).find(
        (element) => element.getAttribute('data-vean-tree-value') === value,
      )
      if (item === undefined) focusedValue = null
      else item.focus({ preventScroll: true })
    })
  }

  return { beforeUpdate, afterUpdate, onFocusIn, onFocusOut }
}
