import type { ThemeSize } from '#ui/theme'
import type {
  DropdownMenuCompactEmits,
  DropdownMenuCompactProps,
  DropdownMenuCompactSlots,
  DropdownMenuUi,
} from '@soybeanjs/headless/dropdown-menu'
import type { ClassValue, DefinedValue } from '@soybeanjs/headless/types'

export type { MenuOptionData } from '@soybeanjs/headless/menu'

export interface DropdownMenuProps<
  T extends DefinedValue = DefinedValue,
> extends DropdownMenuCompactProps<T> {
  class?: ClassValue
  size?: ThemeSize
  ui?: Partial<DropdownMenuUi>
}

export type DropdownMenuEmits<T extends DefinedValue = DefinedValue> = DropdownMenuCompactEmits<T>
export type DropdownMenuSlots<T extends DefinedValue = DefinedValue> = DropdownMenuCompactSlots<T>
