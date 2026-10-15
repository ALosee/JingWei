import type { ThemeSize } from '#ui/theme'
import type { BaseProps, ClassValue, UiClass } from '@vean/aria/types'
import type { VNodeChild } from 'vue'

import type { IconValue } from '../icon/types'

/**
 * Properties for the empty root element.
 */
export type EmptyRootProps = BaseProps

/**
 * Properties for the empty header element.
 */
export type EmptyHeaderProps = BaseProps

/**
 * Properties for the empty media element.
 */
export type EmptyMediaProps = BaseProps

/**
 * Properties for the empty content element.
 */
export type EmptyContentProps = BaseProps

/**
 * Properties for the empty title element.
 */
export type EmptyTitleProps = BaseProps

/**
 * Properties for the empty description element.
 */
export type EmptyDescriptionProps = BaseProps

/**
 * Available UI slots for the Empty component.
 */
export type EmptyUiSlot = 'root' | 'header' | 'media' | 'content' | 'title' | 'description'

/**
 * UI class overrides for the Empty component.
 */
export type EmptyUi = UiClass<EmptyUiSlot>

/**
 * Properties for the Empty component.
 */
export interface EmptyProps extends EmptyRootProps {
  /**
   * Additional class names applied to the root element.
   */
  class?: ClassValue
  /**
   * Per-slot class overrides for the component.
   */
  ui?: Partial<EmptyUi>
  /**
   * Size variant of the component.
   */
  size?: ThemeSize
  /**
   * Title text rendered by the component.
   */
  title?: string
  /**
   * Description text rendered by the component.
   */
  description?: string
  /**
   * Icon rendered by the component.
   */
  icon?: IconValue
  /**
   * Properties forwarded to the header element.
   */
  headerProps?: EmptyHeaderProps
  /**
   * Properties forwarded to the media element.
   */
  mediaProps?: EmptyMediaProps
  /**
   * Properties forwarded to the content element.
   */
  contentProps?: EmptyContentProps
  /**
   * Properties forwarded to the title element.
   */
  titleProps?: EmptyTitleProps
  /**
   * Properties forwarded to the description element.
   */
  descriptionProps?: EmptyDescriptionProps
}

/**
 * Slots for the Empty component.
 */
export interface EmptySlots {
  /**
   * Custom content for the default slot.
   */
  default?: () => VNodeChild
  /**
   * Custom content for the media slot.
   */
  media?: () => VNodeChild
  /**
   * Custom content for the title slot.
   */
  title?: () => VNodeChild
  /**
   * Custom content for the description slot.
   */
  description?: () => VNodeChild
  /**
   * Custom content for the content slot.
   */
  content?: () => VNodeChild
}
