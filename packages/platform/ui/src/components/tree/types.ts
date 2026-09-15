import type { FlattenedItem, TreeItemData } from '@soybeanjs/headless/tree'
import type { MaybeArray } from '@soybeanjs/headless/types'

/**
 * Slots for the Tree component.
 */
export interface TreeSlots<T extends TreeItemData> {
  /**
   * Content rendered before the tree items.
   */
  top?: () => unknown
  /**
   * Content rendered after the tree items.
   */
  bottom?: () => unknown
  /**
   * Content for a single tree item.
   */
  item?: (props: {
    item: FlattenedItem<T>
    modelValue: MaybeArray<string> | undefined
    expanded: string[]
  }) => unknown
}
