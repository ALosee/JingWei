import type { ThemeSize } from '#ui/theme'
import type {
  MenubarCompactEmits,
  MenubarCompactProps,
  MenubarCompactSlots,
  MenubarUi,
} from '@soybeanjs/headless/menubar'
import type { AlignSide, ClassValue, DefinedValue } from '@soybeanjs/headless/types'

export interface MenubarProps<
  T extends DefinedValue = DefinedValue,
> extends MenubarCompactProps<T> {
  class?: ClassValue
  size?: ThemeSize
  ui?: Partial<MenubarUi>
  indicatorPosition?: AlignSide
}

export type MenubarEmits<T extends DefinedValue = DefinedValue> = MenubarCompactEmits<T>
export type MenubarSlots<T extends DefinedValue = DefinedValue> = MenubarCompactSlots<T>
