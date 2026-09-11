import type { PageTabsVariant } from '#ui/styles/page-tabs'
import type { ThemeSize } from '#ui/theme'
import type {
  PageTabsCompactEmits,
  PageTabsCompactProps,
  PageTabsCompactSlots,
  PageTabsOptionData,
  PageTabsUi,
} from '@soybeanjs/headless/page-tabs'
import type { ClassValue } from '@soybeanjs/headless/types'

export interface PageTabsProps<
  T extends PageTabsOptionData = PageTabsOptionData,
> extends PageTabsCompactProps<T> {
  class?: ClassValue
  size?: ThemeSize
  variant?: PageTabsVariant
  ui?: Partial<PageTabsUi>
}

export type PageTabsEmits<T extends PageTabsOptionData = PageTabsOptionData> =
  PageTabsCompactEmits<T>
export type PageTabsSlots<T extends PageTabsOptionData = PageTabsOptionData> =
  PageTabsCompactSlots<T>
export type { PageTabsOptionData } from '@soybeanjs/headless/page-tabs'
export type { PageTabsVariant }
