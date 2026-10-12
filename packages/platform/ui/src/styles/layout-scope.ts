import { appShellVariants } from './app-shell'
import { layoutVariants } from './layout'
import type { LayoutStyleScope } from './layout-scope-types'

/** Named group selectors must not borrow state from the surrounding workspace. */
export function scopeLayoutUi<Slot extends string>(
  ui: Record<Slot, string>,
  scope: LayoutStyleScope,
): Record<Slot, string> {
  const scoped = { ...ui }
  if (scope === 'preview') {
    for (const key in scoped)
      scoped[key] = scoped[key].replace(/\/layout(?=[:\s]|$)/g, '/preview-layout')
  }
  return scoped
}

/** Discover every renamed native recipe class at build time, including compound variants. */
export function layoutPreviewSafelist(): string[] {
  const classes = new Set<string>()
  function collect(ui: Record<string, string>): void {
    for (const value of Object.values(scopeLayoutUi(ui, 'preview'))) {
      for (const token of value.split(/\s+/))
        if (token.includes('/preview-layout')) classes.add(token)
    }
  }
  for (const size of ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const) {
    collect(appShellVariants({ size }))
    for (const variant of ['sidebar', 'floating', 'inset'] as const) {
      for (const side of ['left', 'right'] as const) {
        for (const collapsible of ['icon', 'offcanvas'] as const) {
          for (const fullContent of [false, true])
            collect(layoutVariants({ size, variant, side, collapsible, fullContent }))
        }
      }
    }
  }
  return [...classes]
}
