import type { ThemeColor, ThemeSize } from '#ui/theme'
import type {
  SliderCompactProps,
  SliderCompactEmits,
  SliderCompactSlots,
  SliderUi,
} from '@soybeanjs/headless/slider'
import type { ClassValue } from '@soybeanjs/headless/types'

/**
 * Properties for the Slider component.
 */
export interface SliderProps extends SliderCompactProps {
  /**
   * Additional class names applied to the root element.
   */
  class?: ClassValue
  /**
   * Theme color of the component.
   */
  color?: ThemeColor
  /**
   * Visual size of the component.
   */
  size?: ThemeSize
  /**
   * Per-slot class overrides for the component.
   */
  ui?: Partial<SliderUi>
}

/**
 * Events for the Slider component.
 */
export type SliderEmits = SliderCompactEmits

/**
 * Slots for the Slider component.
 */
export type SliderSlots = SliderCompactSlots
