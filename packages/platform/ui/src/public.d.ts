import type { InputClearProps } from '@soybeanjs/headless/input'
import type { ProgressProviderProps } from '@soybeanjs/headless/progress'
import type { ToastProviderProps as HeadlessToastProviderProps } from '@soybeanjs/headless/toast'
import type { DefineComponent } from 'vue'

import type {
  ButtonEmits,
  ButtonGroupProps,
  ButtonIconProps,
  ButtonLinkProps,
  ButtonLoadingProps,
  ButtonProps,
  ButtonShape,
  ButtonShadow,
  ButtonVariant,
} from './components/button/types'
import type { ThemeContext } from './components/config-provider/theme-context'
import type { ConfigProviderProps } from './components/config-provider/types'
import type { DialogEmits, DialogProps, DialogSlots } from './components/dialog/types'
import type { IconProps, IconValue } from './components/icon/types'
import type { InputEmits, InputProps, InputSlots } from './components/input/types'
import type { LinkProps } from './components/link/types'
import type { ProgressCircleProps, ProgressProps } from './components/progress/types'
import type { ToastProviderProps } from './components/toast/types'

type UiComponent<Props = object> = DefineComponent<Props>

export declare const Button: UiComponent<ButtonProps>
export declare const ButtonGroup: UiComponent<ButtonGroupProps>
export declare const ButtonIcon: UiComponent<ButtonIconProps>
export declare const ButtonLink: UiComponent<ButtonLinkProps>
export declare const ButtonLoading: UiComponent<ButtonLoadingProps>
export declare const ConfigProvider: UiComponent<ConfigProviderProps>
export declare const Dialog: UiComponent<DialogProps>
export declare const Icon: UiComponent<IconProps>
export declare const Input: UiComponent<InputProps>
export declare const InputClear: UiComponent<InputClearProps>
export declare const Link: UiComponent<LinkProps>
export declare const PageContainer: UiComponent<{ title: string; description?: string }>
export declare const Progress: UiComponent<ProgressProps>
export declare const ProgressCircle: UiComponent<ProgressCircleProps>
export declare const ProgressProvider: UiComponent<ProgressProviderProps>
export declare const ThemeSettingsPanel: UiComponent
export declare const ToastProvider: UiComponent<HeadlessToastProviderProps & ToastProviderProps>

export { dialog } from '@soybeanjs/headless/dialog'
export { progress } from '@soybeanjs/headless/progress'
export { toast } from '@soybeanjs/headless/toast'

export declare function useTheme(): ThemeContext | null

export type {
  ButtonEmits,
  ButtonGroupProps,
  ButtonIconProps,
  ButtonLinkProps,
  ButtonLoadingProps,
  ButtonProps,
  ButtonShape,
  ButtonShadow,
  ButtonVariant,
  ConfigProviderProps,
  DialogEmits,
  DialogProps,
  DialogSlots,
  IconProps,
  IconValue,
  InputEmits,
  InputProps,
  InputSlots,
  LinkProps,
  ThemeContext,
}
