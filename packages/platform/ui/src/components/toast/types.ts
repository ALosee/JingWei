import type { ThemeSize } from '#ui/theme'
import type { ToastProviderProps as _ToastProviderProps, ToastUi } from '@vean/aria/toast'

/**
 * Properties for the ToastProvider component.
 */
export interface ToastProviderProps extends _ToastProviderProps {
  /**
   * Visual size of the component.
   */
  size?: ThemeSize
  /**
   * Per-slot class overrides for the component.
   */
  ui?: ToastUi
}
