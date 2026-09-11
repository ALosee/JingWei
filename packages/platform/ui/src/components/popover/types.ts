import type { ThemeSize } from '#ui/theme'
import type {
  PopoverCompactEmits,
  PopoverCompactProps,
  PopoverCompactSlots,
  PopoverUi,
} from '@soybeanjs/headless/popover'
import type { ClassValue } from '@soybeanjs/headless/types'

export interface PopoverProps extends PopoverCompactProps {
  class?: ClassValue
  size?: ThemeSize
  ui?: Partial<PopoverUi>
}

export type PopoverEmits = PopoverCompactEmits
export type PopoverSlots = PopoverCompactSlots
