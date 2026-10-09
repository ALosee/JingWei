import type {
  FlattenedItem,
  TreeItemData,
  TreeVirtualizerRootEmits,
  TreeVirtualizerRootProps,
} from '@vean/aria/tree'
import type { MaybeArray } from '@vean/aria/types'
import type {
  VirtualizerContentProps,
  VirtualizerDynamicContentProps,
} from '@vean/aria/virtualizer'

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

/**
 * Properties for the TreeVirtualizer component.
 */
export interface TreeVirtualizerProps<
  T extends TreeItemData,
  U extends MaybeArray<string> | undefined,
  M extends boolean,
> extends TreeVirtualizerRootProps<T, U, M> {
  /**
   * Properties forwarded to the content element.
   */
  contentProps?: VirtualizerContentProps
  /**
   * Properties forwarded to the dynamic content element.
   */
  dynamicContentProps?: VirtualizerDynamicContentProps
  /**
   * When `true`, renders visible items in normal document flow (dynamic mode) so
   * item positions stay correct across expand/collapse without absolute offsets.
   *
   * @defaultValue false
   */
  animated?: boolean
}

/**
 * Events for the TreeVirtualizer component.
 */
export type TreeVirtualizerEmits<M extends boolean | undefined> = TreeVirtualizerRootEmits<M>
