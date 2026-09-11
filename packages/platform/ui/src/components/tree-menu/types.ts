import type { ThemeSize } from '#ui/theme'
import type {
  TreeMenuBaseOptionData,
  TreeMenuCompactEmits,
  TreeMenuCompactProps,
  TreeMenuCompactSlots,
  TreeMenuUiSlot,
} from '@soybeanjs/headless/tree-menu'
import type { ClassValue } from '@soybeanjs/headless/types'

export interface TreeMenuProps<
  T extends TreeMenuBaseOptionData = TreeMenuBaseOptionData,
> extends TreeMenuCompactProps<T> {
  class?: ClassValue
  size?: ThemeSize
  ui?: Partial<Record<TreeMenuUiSlot, ClassValue>>
}

export type TreeMenuEmits = TreeMenuCompactEmits
export type TreeMenuSlots<T extends TreeMenuBaseOptionData = TreeMenuBaseOptionData> =
  TreeMenuCompactSlots<T>
