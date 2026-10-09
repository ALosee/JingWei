import type { MenuOptionData } from '@vean/aria/menu'
import type { TreeNavOptionData } from '@vean/aria/tree-nav'

type PopupGroupOption = TreeNavOptionData & Pick<MenuOptionData<string>, 'isGroupLabel'>

/** Popup groups use a label followed by sibling entries; top-level groups remain branch triggers. */
export function withTreeNavPopupGroups(
  items: readonly TreeNavOptionData[],
  popup = false,
): PopupGroupOption[] {
  return items.flatMap((item) => {
    if (popup && item.isGroup === true) {
      if (item.hidden) return []
      const label: PopupGroupOption = { ...item, isGroupLabel: true }
      Reflect.deleteProperty(label, 'children')
      return [label, ...withTreeNavPopupGroups(item.children ?? [], true)]
    }
    return [
      {
        ...item,
        isGroupLabel: false,
        ...(item.children === undefined
          ? {}
          : { children: withTreeNavPopupGroups(item.children, true) }),
      },
    ]
  })
}
