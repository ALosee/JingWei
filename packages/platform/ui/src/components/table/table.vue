<script
  setup
  lang="ts"
  generic="
    T extends TableBaseData = TableBaseData,
    R extends string | number = string | number,
    M extends boolean = boolean
  "
>
import { tableVariants } from '#ui/styles/table'
import { miniSizeMap } from '#ui/theme'
import { useLocaleMessages } from '@vean/aria'
import { useForwardListeners, useOmitProps } from '@vean/aria/composables'
import { keysOf } from '@vean/aria/shared'
import { provideTableUi, TableCompact } from '@vean/aria/table'
import type { TableSortOrder } from '@vean/aria/table'
import { computed, useTemplateRef } from 'vue'

import SButtonIcon from '../button/button-icon.vue'
import SCheckbox from '../checkbox/checkbox.vue'
import SEmpty from '../empty/empty.vue'
import TableFilterPopover from './table-filter-popover.vue'
import TableRadio from './table-radio.vue'
import type {
  TableProps,
  TableBaseData,
  TableEmits,
  TableSlots,
  TableEngineInstance,
} from './types'

defineOptions({
  name: 'STable',
})

const props = withDefaults(defineProps<TableProps<T, R, M>>(), {
  // `ExpandedState` includes the literal `true`, which triggers Vue's Boolean
  // casting for absent props; explicit undefined defaults keep them optional.
  expanded: undefined,
  defaultExpanded: undefined,
  // Preserve an absent Boolean prop so TableCompact owns its default multiple selection.
  multiple: undefined,
})

const emit = defineEmits<TableEmits<T, R, M>>()

const slots = defineSlots<TableSlots<T>>()

const forwardedProps = useOmitProps(props, [
  'class',
  'ui',
  'size',
  'variant',
  'bordered',
  'rounded',
  'striped',
])

const tableCompactRef = useTemplateRef<{ table: TableEngineInstance<T> }>('tableCompactRef')

const listeners = useForwardListeners(emit)

const slotNames = computed(() => keysOf(slots))

const ui = computed(() =>
  tableVariants(
    {
      size: props.size,
      variant: props.variant,
      bordered: props.bordered,
      rounded: props.rounded,
      striped: props.striped,
    },
    props.ui,
    { root: props.class },
  ),
)

const miniSize = computed(() => miniSizeMap[props.size ?? 'md'])

const messages = useLocaleMessages()

const getOrderIcon = (sortOrder?: TableSortOrder) => {
  return sortOrder === 'asc'
    ? 'lucide:arrow-up'
    : sortOrder === 'desc'
      ? 'lucide:arrow-down'
      : 'lucide:arrow-up-down'
}

provideTableUi(ui)

// Forward the engine instance as the whole exposed surface, so consumers call
// `tableRef.value.previousPage()` instead of `tableRef.value.table.previousPage()`.
// The instance exists only after the inner TableCompact mounts, hence the lazy
// forwarding; engine methods close over their own instance (no `this`), so
// unbound forwarding is safe.
defineExpose(
  new Proxy({} as TableEngineInstance<T>, {
    get: (_, key) => tableCompactRef.value?.table[key as keyof TableEngineInstance<T>],
    has: (_, key) => {
      const table = tableCompactRef.value?.table

      return table !== undefined && key in table
    },
  }),
)
</script>

<template>
  <TableCompact ref="tableCompactRef" v-bind="forwardedProps" v-on="listeners">
    <template v-for="slotName in slotNames" :key="slotName" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps" />
    </template>

    <template
      v-if="!slots['header-selection']"
      #header-selection="{
        checked,
        disabled,
        multiple: selectionMultiple,
        ariaLabel,
        updateChecked,
      }"
    >
      <SCheckbox
        v-if="selectionMultiple"
        :disabled="disabled"
        :model-value="checked"
        :class="ui.selection"
        :control-props="{ 'aria-label': ariaLabel }"
        @update:model-value="updateChecked"
      />
    </template>

    <template
      v-if="!slots.selection"
      #selection="{ checked, multiple: selectionMultiple, ariaLabel, toggleSelect }"
    >
      <SCheckbox
        v-if="selectionMultiple"
        :class="ui.selection"
        :model-value="checked"
        :control-props="{ 'aria-label': ariaLabel }"
        @update:model-value="toggleSelect()"
      />
      <TableRadio
        v-else
        :size="size"
        :checked="checked"
        :aria-label="ariaLabel"
        @click="toggleSelect()"
      />
    </template>

    <template v-if="!slots['header-sort']" #header-sort="{ sortOrder, ariaLabel, toggleSort }">
      <SButtonIcon
        :icon="getOrderIcon(sortOrder)"
        :class="ui.sortTrigger"
        :size="miniSize"
        :aria-label="ariaLabel"
        :data-sorted="sortOrder ? '' : undefined"
        @click="toggleSort()"
      />
    </template>

    <template v-if="!slots['header-filter']" #header-filter="slotProps">
      <TableFilterPopover v-bind="slotProps" :ui="ui" :size="size" />
    </template>

    <template
      v-if="!slots['header-resize']"
      #header-resize="{
        resizing,
        ariaLabel,
        onPointerdown: resizePointerdown,
        onKeydown: resizeKeydown,
      }"
    >
      <button
        type="button"
        :class="ui.resizeHandle"
        :aria-label="ariaLabel"
        :aria-pressed="resizing"
        :data-resizing="resizing || undefined"
        @pointerdown="resizePointerdown"
        @keydown="resizeKeydown"
      />
    </template>

    <template
      v-if="!slots['tree-toggle']"
      #tree-toggle="{ expanded: rowExpanded, ariaLabel, toggleExpand }"
    >
      <SButtonIcon
        :class="ui.treeToggle"
        :size="miniSize"
        :aria-expanded="rowExpanded"
        :aria-label="ariaLabel"
        :icon="rowExpanded ? 'lucide:chevron-down' : 'lucide:chevron-right'"
        @click="toggleExpand()"
      />
    </template>

    <template
      v-if="!slots.expand"
      #expand="{ expanded: rowExpanded, ariaLabel, hasChildren, toggleExpand }"
    >
      <SButtonIcon
        v-if="hasChildren || slots['expanded-row']"
        :icon="rowExpanded ? 'lucide:chevron-down' : 'lucide:chevron-right'"
        :class="ui.treeToggle"
        :size="miniSize"
        :aria-expanded="rowExpanded"
        :aria-label="ariaLabel"
        :data-expanded="rowExpanded ? '' : undefined"
        @click="toggleExpand()"
      />
    </template>

    <template v-if="!slots.empty" #empty>
      <SEmpty
        :title="messages.table.emptyTitle"
        :description="messages.table.emptyDescription"
        icon="lucide:inbox"
        media-variant="icon"
      />
    </template>
  </TableCompact>
</template>
