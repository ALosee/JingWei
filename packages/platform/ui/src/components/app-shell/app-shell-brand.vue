<script setup lang="ts">
import type { ThemeSize } from '#ui/theme'
import type { ClassValue } from '@vean/aria/types'
import { computed } from 'vue'

import type { AppShellBrandLayout } from './shared'
import type { AppShellBrandSlotProps, AppShellLogoPlacementResolved } from './types'

defineOptions({
  name: 'AppShellBrand',
})

interface Props {
  /** Resolved placement of the region. */
  placement: AppShellLogoPlacementResolved
  /** Whether the sidebar is collapsed. */
  collapsed: boolean
  /** Cell geometry of the current mode and sidebar state. */
  layout: AppShellBrandLayout
  /** Visual size, shared with the menu the brand mirrors. */
  size: ThemeSize
  /** Class of the region. */
  regionClass: ClassValue
  /** Class of the mark cell. */
  markClass: ClassValue
  /** Class of the title cell. */
  titleClass: ClassValue
}

const props = defineProps<Props>()

interface Slots {
  logo?: (props: AppShellBrandSlotProps) => unknown
  title?: (props: AppShellBrandSlotProps) => unknown
}

const slots = defineSlots<Slots>()

/** A cell sized to the column it aligns to; `undefined` lets the content size it. */
function toCellStyle(width: number | undefined) {
  return width === undefined ? undefined : { width: `${width}rem` }
}

const slotProps = computed<AppShellBrandSlotProps>(() => ({
  collapsed: props.collapsed,
  placement: props.placement,
}))

/**
 * Whether the mark and the title align to the sidebar's columns.
 *
 * Only the rail modes do; everywhere else the two share one row and are sized by
 * their own content.
 */
const aligned = computed(() => props.layout.markWidth !== undefined)

/**
 * A brand rendered in the sidebar.
 *
 * It shares the menu's inset, while its row keeps the brand mark's actual size.
 * A menu icon cell is narrower than a brand mark after its padding is applied,
 * so the brand must not inherit that fixed cell width or clipping.
 */
const inSidebar = computed(() => props.placement !== 'header')

/**
 * Collapsed state the mirrored item folds on.
 *
 * The rail keeps its column while the sidebar folds — the mark stays on it — so
 * only a single-column sidebar folds its brand row together with the menu.
 */
const itemState = computed(() => (props.collapsed && !aligned.value ? 'collapsed' : 'expanded'))

const markStyle = computed(() => toCellStyle(props.layout.markWidth))

const titleStyle = computed(() => toCellStyle(props.layout.titleWidth))

const showTitle = computed(() => Boolean(slots.title) && props.layout.titleVisible)
</script>

<template>
  <div
    :class="[regionClass, inSidebar ? 'group' : undefined]"
    data-vean-app-shell-logo
    :data-placement="placement"
    :data-aligned="aligned ? 'true' : undefined"
    :data-collapsed="collapsed ? 'true' : undefined"
    :data-inset="inSidebar && !aligned ? 'menu' : undefined"
    :data-state="inSidebar ? itemState : undefined"
  >
    <!--
      A single-column sidebar shares one brand row. When folded, the full row
      centers the actual mark without squeezing it into a padded menu icon cell.
    -->
    <div
      v-if="inSidebar && !aligned"
      data-vean-app-shell-logo-mark
      class="w-full min-w-0 flex items-center gap-[--sl-half-spacing]"
      :class="collapsed ? 'justify-center' : undefined"
    >
      <slot name="logo" v-bind="slotProps" />
      <span
        v-if="showTitle"
        class="min-w-0 flex items-center truncate"
        data-vean-app-shell-logo-title
      >
        <slot name="title" v-bind="slotProps" />
      </span>
    </div>

    <!--
      A rail sidebar: the mark keeps the rail column and the title the pane one.
      The divider those columns carry belongs to the menu that draws it, so this
      placement does not fake it.
    -->
    <template v-else-if="inSidebar">
      <div :class="markClass" :style="markStyle" data-vean-app-shell-logo-mark>
        <slot name="logo" v-bind="slotProps" />
      </div>
      <div v-if="showTitle" :class="titleClass" :style="titleStyle" data-vean-app-shell-logo-title>
        <slot name="title" v-bind="slotProps" />
      </div>
    </template>

    <template v-else>
      <div :class="markClass" :style="markStyle" data-vean-app-shell-logo-mark>
        <slot name="logo" v-bind="slotProps" />
      </div>
      <div v-if="showTitle" :class="titleClass" :style="titleStyle" data-vean-app-shell-logo-title>
        <slot name="title" v-bind="slotProps" />
      </div>
    </template>
  </div>
</template>
