import type { InputClearProps } from '@vean/aria/input'
import type { LayoutTriggerProps } from '@vean/aria/layout'
import type { ProgressProviderProps } from '@vean/aria/progress'
import type {
  TableRowProps,
  TableCellProps,
  TableEngineTable,
  TableRowEventPayload,
} from '@vean/aria/table'
import type { TextareaClearProps } from '@vean/aria/textarea'
import type { ToastProviderProps as HeadlessToastProviderProps } from '@vean/aria/toast'
import type {
  FlattenedItem,
  TreeItemData,
  TreeItemEmits,
  TreeItemProps,
  TreeRootEmits,
  TreeRootProps,
  TreeVirtualizerItemProps,
  TreeVirtualizerItemEmits,
} from '@vean/aria/tree'
import type { TreeNavOptionData } from '@vean/aria/tree-nav'
import type { MaybeArray } from '@vean/aria/types'
import type { PaletteLevel } from '@vean/theme'
import type { ColorValue as ThemeColorValue } from '@vean/theme'
import type { DefineComponent, PublicProps, VNode } from 'vue'

import type {
  AppShellProps,
  AppShellEmits,
  AppShellSlots,
  AppShellMode,
  AppShellMenuItem,
  AppShellMenuProps,
  AppShellMenuUi,
  AppShellUi,
  AppShellLogoPlacement,
} from './components/app-shell/types'
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
import type {
  CheckboxProps,
  CheckboxEmits,
  CheckboxGroupProps,
  CheckboxGroupEmits,
  CheckboxCardProps,
  CheckboxCardEmits,
  CheckboxCardGroupProps,
  CheckboxCardGroupEmits,
  CheckboxGroupOptionData,
  CheckboxCardGroupOptionData,
} from './components/checkbox/types'
import type { ThemeContext } from './components/config-provider/theme-context'
import type { ConfigProviderProps } from './components/config-provider/types'
import type { DialogEmits, DialogProps, DialogSlots } from './components/dialog/types'
import type {
  DropdownMenuEmits,
  DropdownMenuProps,
  DropdownMenuSlots,
  MenuOptionData,
} from './components/dropdown-menu/types'
import type { EmptyProps, EmptySlots } from './components/empty/types'
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
import type {
  PaletteChangePayload,
  PalettePickerEmits,
  PalettePickerProps,
  PaletteSelectValue,
} from './components/palette-picker/types'
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
import type { SplitNavProps, SplitNavEmits, SplitNavSlots } from './components/split-nav/types'
import type {
  SplitterGroupEmits,
  SplitterGroupProps,
  SplitterPanelEmits,
  SplitterPanelExposed,
  SplitterPanelProps,
  SplitterResizeHandleEmits,
  SplitterResizeHandleProps,
} from './components/splitter/types'
import type { SwitchEmits, SwitchProps, SwitchShape, SwitchSlots } from './components/switch/types'
import type {
  TableProps,
  TableEmits,
  TableSlots,
  TableColumn,
  TableBaseData,
  TableSortOrder,
  TableColumnType,
  TableColumnFilterOption,
  TableColumnFilterValue,
} from './components/table/types'
import type { TabsEmits, TabsOptionData, TabsProps, TabsSlots } from './components/tabs/types'
import type { TextareaEmits, TextareaProps, TextareaSlots } from './components/textarea/types'
import type {
  ThemeCustomizerProps,
  ThemeCustomizerSection,
} from './components/theme-customizer/types'
import type { ThemeModeSegmentProps } from './components/theme-mode-segment/types'
import type { ToastProviderProps } from './components/toast/types'
import type { TreeMenuEmits, TreeMenuProps, TreeMenuSlots } from './components/tree-menu/types'
import type { TreeNavProps, TreeNavEmits, TreeNavSlots } from './components/tree-nav/types'
import type { TreeSlots, TreeVirtualizerProps, TreeVirtualizerEmits } from './components/tree/types'
import type {
  ManagementListToolbarEmits,
  ManagementListToolbarProps,
  ManagementListToolbarSlots,
  ManagementWorkspaceEmits,
  ManagementWorkspaceProps,
  ManagementWorkspaceSlots,
} from './patterns/management-workspace/types'
import type { ThemePaletteColors } from './patterns/theme-palette/theme-palette'
import type {
  ThemePaletteSelectItem,
  ThemePaletteSelectProps,
} from './patterns/theme-palette/types'
import type { ThemeColorTokens } from './theme/types'

type UiComponent<Props = object> = DefineComponent<Props>

export declare const AppShell: UiComponent<AppShellProps>
export declare const SplitNav: UiComponent<SplitNavProps>
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
export declare const ManagementListToolbar: UiComponent<ManagementListToolbarProps>
export declare const ManagementWorkspace: UiComponent<ManagementWorkspaceProps>
export declare const PageTabs: UiComponent<PageTabsProps<PageTabsOptionData>>
export declare const PalettePicker: UiComponent<PalettePickerProps>
export declare const Popover: UiComponent<PopoverProps>
export declare const Progress: UiComponent<ProgressProps>
export declare const ProgressCircle: UiComponent<ProgressCircleProps>
export declare const ProgressProvider: UiComponent<ProgressProviderProps>
export declare const Segment: UiComponent<SegmentProps<SegmentOptionData>>
export declare const Select: UiComponent<SelectProps>
export declare const Separator: UiComponent<SeparatorProps>
export declare const Slider: UiComponent<SliderProps>
export declare const SplitterGroup: UiComponent<SplitterGroupProps>
export declare const SplitterPanel: UiComponent<SplitterPanelProps>
export declare const SplitterResizeHandle: UiComponent<SplitterResizeHandleProps>
export declare const ThemeCustomizer: UiComponent
export declare const ThemeSettingsPanel: UiComponent<ThemeCustomizerProps>
export declare const ThemeModeSegment: UiComponent<ThemeModeSegmentProps>
export declare const ThemePaletteSelect: UiComponent<ThemePaletteSelectProps>
export declare const ThemeScope: UiComponent<{
  theme: ConfigProviderProps['theme']
  mode?: 'light' | 'dark'
}>
export declare const Tooltip: UiComponent
export declare const ToastProvider: UiComponent<HeadlessToastProviderProps & ToastProviderProps>
export declare const Tabs: UiComponent<TabsProps<TabsOptionData>>
export declare const TreeNav: UiComponent<TreeNavProps>
export declare const TreeMenu: UiComponent<TreeMenuProps>
export declare const Tree: UiComponent<TreeRootProps>
export declare const TreeItem: UiComponent<TreeItemProps>
export declare const TreeVirtualizer: UiComponent<
  TreeVirtualizerProps<TreeItemData, MaybeArray<string> | undefined, boolean>
>
export declare const TreeVirtualizerItem: UiComponent<TreeVirtualizerItemProps>
export declare const Switch: UiComponent<SwitchProps>
export declare const Textarea: UiComponent<TextareaProps>
export declare const TextareaClear: UiComponent<TextareaClearProps>

export { dialog } from '@vean/aria/dialog'
export { progress } from '@vean/aria/progress'
export { toast } from '@vean/aria/toast'
export type { TreeSelectEvent, TreeToggleEvent } from '@vean/aria/types'

export declare function useTheme(): ThemeContext | null
export declare function generateThemePaletteColors(seedColor: string): ThemePaletteColors
export declare function getThemePaletteColors(
  key: string,
  target: 'base' | 'primary',
): Partial<ThemePaletteColors>
export declare function normalizeThemePaletteColor(input: string): {
  hsl: string
  oklch: string
}
export declare const themePaletteLevels: readonly PaletteLevel[]

export type {
  ThemeCustomizerProps,
  ThemeCustomizerSection,
  PaletteChangePayload,
  PalettePickerEmits,
  PalettePickerProps,
  PaletteSelectValue,
  ThemePaletteColors,
  ThemePaletteSelectItem,
  ThemePaletteSelectProps,
  ThemeColorTokens,
  ThemeColorValue,
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
  ManagementListToolbarEmits,
  ManagementListToolbarProps,
  ManagementListToolbarSlots,
  ManagementWorkspaceEmits,
  ManagementWorkspaceProps,
  ManagementWorkspaceSlots,
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
  SplitterGroupEmits,
  SplitterGroupProps,
  SplitterPanelEmits,
  SplitterPanelExposed,
  SplitterPanelProps,
  SplitterResizeHandleEmits,
  SplitterResizeHandleProps,
  SwitchEmits,
  SwitchProps,
  SwitchShape,
  SwitchSlots,
  TextareaEmits,
  TextareaProps,
  TextareaSlots,
  TabsEmits,
  TabsOptionData,
  TabsProps,
  TabsSlots,
  ThemeContext,
  ThemeModeSegmentProps,
  TreeNavProps,
  TreeNavEmits,
  TreeNavSlots,
  TreeNavOptionData,
  TreeMenuEmits,
  TreeMenuProps,
  TreeMenuSlots,
  TreeItemData,
  TreeItemProps,
  TreeItemEmits,
  TreeRootEmits as TreeEmits,
  TreeRootProps as TreeProps,
  TreeSlots,
  TreeVirtualizerProps,
  TreeVirtualizerEmits,
  TreeVirtualizerItemProps,
  TreeVirtualizerItemEmits,
  FlattenedItem,
}

export type {
  AppShellProps,
  AppShellEmits,
  AppShellSlots,
  AppShellMode,
  AppShellMenuItem,
  AppShellMenuProps,
  AppShellMenuUi,
  AppShellUi,
  AppShellLogoPlacement,
  SplitNavProps,
  SplitNavEmits,
  SplitNavSlots,
}

type TableEventProps<T extends TableBaseData, R extends string | number, M extends boolean> = {
  [Event in keyof TableEmits<T, R, M> as `on${Capitalize<Event>}`]?: (
    ...args: TableEmits<T, R, M>[Event]
  ) => void
}
type TablePublicContext<T extends TableBaseData, R extends string | number, M extends boolean> = {
  props: TableProps<T, R, M> & TableEventProps<T, R, M> & PublicProps
  slots: TableSlots<T>
  attrs: Record<string, unknown>
  emit: <Event extends keyof TableEmits<T, R, M>>(
    event: Event,
    ...args: TableEmits<T, R, M>[Event]
  ) => void
  expose: (exposed: TableEngineTable<T>) => void
}
/** Keep row/slot inference without rechecking the copied SFC under a consumer's compiler options. */
export declare const Table: <
  T extends TableBaseData,
  R extends string | number,
  M extends boolean = true,
>(
  props: TablePublicContext<T, R, M>['props'],
  context?: Pick<TablePublicContext<T, R, M>, 'slots' | 'attrs' | 'emit'>,
  exposed?: TablePublicContext<T, R, M>['expose'],
) => VNode & { __ctx?: TablePublicContext<T, R, M> }
export declare const TableRow: UiComponent<TableRowProps>
export declare const TableCell: UiComponent<TableCellProps>
export declare const Checkbox: UiComponent<CheckboxProps>
export declare const CheckboxGroup: UiComponent<CheckboxGroupProps>
export declare const CheckboxCard: UiComponent<CheckboxCardProps>
export declare const CheckboxCardGroup: UiComponent<CheckboxCardGroupProps>
export declare const Empty: UiComponent<EmptyProps>
export type {
  TableProps,
  TableEmits,
  TableSlots,
  TableColumn,
  TableBaseData,
  TableSortOrder,
  TableColumnType,
  TableColumnFilterOption,
  TableColumnFilterValue,
  TableRowProps,
  TableCellProps,
  TableEngineTable,
  TableRowEventPayload,
  CheckboxProps,
  CheckboxEmits,
  CheckboxGroupProps,
  CheckboxGroupEmits,
  CheckboxCardProps,
  CheckboxCardEmits,
  CheckboxCardGroupProps,
  CheckboxCardGroupEmits,
  CheckboxGroupOptionData,
  CheckboxCardGroupOptionData,
  EmptyProps,
  EmptySlots,
}
