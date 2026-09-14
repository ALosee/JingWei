import type { InputClearProps } from '@soybeanjs/headless/input'
import type { LayoutTriggerProps } from '@soybeanjs/headless/layout'
import type { ProgressProviderProps } from '@soybeanjs/headless/progress'
import type { ToastProviderProps as HeadlessToastProviderProps } from '@soybeanjs/headless/toast'
import type { DefineComponent } from 'vue'

import type {
  BreadcrumbEmits,
  BreadcrumbOptionData,
  BreadcrumbProps,
  BreadcrumbSlots,
} from './components/breadcrumb/types'
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
import type {
  DropdownMenuEmits,
  DropdownMenuProps,
  DropdownMenuSlots,
  MenuOptionData,
} from './components/dropdown-menu/types'
import type { IconProps, IconValue } from './components/icon/types'
import type {
  InputNumberEmits,
  InputNumberProps,
  InputNumberSlots,
} from './components/input-number/types'
import type { InputEmits, InputProps, InputSlots } from './components/input/types'
import type {
  LayoutCollapsible,
  LayoutEmits,
  LayoutProps,
  LayoutScrollBehavior,
  LayoutSide,
  LayoutSlots,
  LayoutVariant,
} from './components/layout/types'
import type { LinkProps } from './components/link/types'
import type { MenubarEmits, MenubarProps, MenubarSlots } from './components/menubar/types'
import type {
  PageTabsEmits,
  PageTabsOptionData,
  PageTabsProps,
  PageTabsSlots,
  PageTabsVariant,
} from './components/page-tabs/types'
import type { PopoverEmits, PopoverProps, PopoverSlots } from './components/popover/types'
import type { ProgressCircleProps, ProgressProps } from './components/progress/types'
import type {
  SegmentEmits,
  SegmentOptionData,
  SegmentProps,
  SegmentSlots,
} from './components/segment/types'
import type {
  SelectEmits,
  SelectOptionData,
  SelectProps,
  SelectSingleOptionData,
  SelectSlots,
} from './components/select/types'
import type { SeparatorProps } from './components/separator/types'
import type { SliderEmits, SliderProps } from './components/slider/types'
import type { SwitchEmits, SwitchProps, SwitchShape, SwitchSlots } from './components/switch/types'
import type { TabsEmits, TabsOptionData, TabsProps, TabsSlots } from './components/tabs/types'
import type { ToastProviderProps } from './components/toast/types'
import type { TreeMenuEmits, TreeMenuProps, TreeMenuSlots } from './components/tree-menu/types'
import type {
  ThemeCustomizerProps,
  ThemeCustomizerSection,
} from './patterns/theme-settings-panel/types'

type UiComponent<Props = object> = DefineComponent<Props>

export declare const Button: UiComponent<ButtonProps>
export declare const ButtonGroup: UiComponent<ButtonGroupProps>
export declare const ButtonIcon: UiComponent<ButtonIconProps>
export declare const ButtonLink: UiComponent<ButtonLinkProps>
export declare const ButtonLoading: UiComponent<ButtonLoadingProps>
export declare const Breadcrumb: UiComponent<BreadcrumbProps<BreadcrumbOptionData>>
export declare const BreadcrumbEllipsis: UiComponent
export declare const BreadcrumbPage: UiComponent
export declare const Collapsible: UiComponent
export declare const ConfigProvider: UiComponent<ConfigProviderProps>
export declare const ColorPicker: UiComponent
export declare const Dialog: UiComponent<DialogProps>
export declare const DropdownMenu: UiComponent<DropdownMenuProps<string>>
export declare const Icon: UiComponent<IconProps>
export declare const Input: UiComponent<InputProps>
export declare const InputClear: UiComponent<InputClearProps>
export declare const InputNumber: UiComponent<InputNumberProps>
export declare const Link: UiComponent<LinkProps>
export declare const Layout: UiComponent<LayoutProps>
export declare const LayoutTrigger: UiComponent<LayoutTriggerProps>
export declare const Menubar: UiComponent<MenubarProps<string>>
export declare const PageContainer: UiComponent<{ title: string; description?: string }>
export declare const PageTabs: UiComponent<PageTabsProps<PageTabsOptionData>>
export declare const Popover: UiComponent<PopoverProps>
export declare const Progress: UiComponent<ProgressProps>
export declare const ProgressCircle: UiComponent<ProgressCircleProps>
export declare const ProgressProvider: UiComponent<ProgressProviderProps>
export declare const Segment: UiComponent<SegmentProps<SegmentOptionData>>
export declare const Select: UiComponent<SelectProps>
export declare const Separator: UiComponent<SeparatorProps>
export declare const Slider: UiComponent<SliderProps>
export declare const ThemeCustomizer: UiComponent
export declare const ThemeSettingsPanel: UiComponent<ThemeCustomizerProps>
export declare const Tooltip: UiComponent
export declare const ToastProvider: UiComponent<HeadlessToastProviderProps & ToastProviderProps>
export declare const Tabs: UiComponent<TabsProps<TabsOptionData>>
export declare const TreeMenu: UiComponent<TreeMenuProps>
export declare const Switch: UiComponent<SwitchProps>

export { dialog } from '@soybeanjs/headless/dialog'
export { progress } from '@soybeanjs/headless/progress'
export { toast } from '@soybeanjs/headless/toast'

export declare function useTheme(): ThemeContext | null

export type {
  ThemeCustomizerProps,
  ThemeCustomizerSection,
  ButtonEmits,
  ButtonGroupProps,
  ButtonIconProps,
  ButtonLinkProps,
  ButtonLoadingProps,
  ButtonProps,
  ButtonShape,
  ButtonShadow,
  ButtonVariant,
  BreadcrumbEmits,
  BreadcrumbOptionData,
  BreadcrumbProps,
  BreadcrumbSlots,
  ConfigProviderProps,
  DialogEmits,
  DialogProps,
  DialogSlots,
  DropdownMenuEmits,
  DropdownMenuProps,
  DropdownMenuSlots,
  MenuOptionData,
  IconProps,
  IconValue,
  InputEmits,
  InputProps,
  InputSlots,
  InputNumberEmits,
  InputNumberProps,
  InputNumberSlots,
  LinkProps,
  LayoutCollapsible,
  LayoutEmits,
  LayoutProps,
  LayoutScrollBehavior,
  LayoutSide,
  LayoutSlots,
  LayoutTriggerProps,
  LayoutVariant,
  MenubarEmits,
  MenubarProps,
  MenubarSlots,
  PageTabsEmits,
  PageTabsOptionData,
  PageTabsProps,
  PageTabsSlots,
  PageTabsVariant,
  PopoverEmits,
  PopoverProps,
  PopoverSlots,
  SegmentEmits,
  SegmentOptionData,
  SegmentProps,
  SegmentSlots,
  SelectEmits,
  SelectOptionData,
  SelectProps,
  SelectSingleOptionData,
  SelectSlots,
  SeparatorProps,
  SliderEmits,
  SliderProps,
  SwitchEmits,
  SwitchProps,
  SwitchShape,
  SwitchSlots,
  TabsEmits,
  TabsOptionData,
  TabsProps,
  TabsSlots,
  ThemeContext,
  TreeMenuEmits,
  TreeMenuProps,
  TreeMenuSlots,
}
