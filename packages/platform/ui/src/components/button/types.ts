import type { ButtonEmits as HeadlessButtonEmits } from '@soybeanjs/headless/button'
import type { ClassValue } from '@soybeanjs/headless/types'

import type { ButtonSize, ButtonVariant } from './button.variants.js'

export interface ButtonProps {
  /** Additional utility classes merged after the component recipe. */
  class?: ClassValue
  /** Prevents pointer and keyboard activation. */
  disabled?: boolean
  /** Prevents interaction and exposes the busy state to assistive technology. */
  loading?: boolean
  /** Controls the button height, padding and text size. */
  size?: ButtonSize
  /** Native button type; defaults to `button` to avoid accidental form submission. */
  type?: 'button' | 'reset' | 'submit'
  /** Controls the semantic visual treatment. */
  variant?: ButtonVariant
}

export type ButtonEmits = HeadlessButtonEmits
export type { ButtonSize, ButtonVariant }
