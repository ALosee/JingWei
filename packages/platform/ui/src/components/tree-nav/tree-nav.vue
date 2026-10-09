<script setup lang="ts">
import { treeNavVariants } from '#ui/styles/tree-nav'
import { useForwardListeners, useOmitProps } from '@vean/aria/composables'
import { keysOf } from '@vean/aria/shared'
import { TreeNavCompact, provideTreeNavUi } from '@vean/aria/tree-nav'
import { computed } from 'vue'

import { provideMenuUi } from '../menu/context'
import { withTreeNavPopupGroups } from './shared'
import type { TreeNavProps, TreeNavEmits, TreeNavSlots } from './types'
import { useTreeNavEscapeFocus } from './use-escape-focus'

defineOptions({
  name: 'STreeNav',
})

const props = defineProps<TreeNavProps>()

const emit = defineEmits<TreeNavEmits>()

// Forwarded scopes resolve against aria internals; the slot contract is
// the shared `MenuOptionsCompactSlots` + `more-trigger`.
const slots = defineSlots<TreeNavSlots>()

const forwardedProps = useOmitProps(props, [
  'class',
  'size',
  'ui',
  'items',
  'popupProps',
  'subContentProps',
])

const items = computed(() => withTreeNavPopupGroups(props.items))

const withEscapeFocus = useTreeNavEscapeFocus()
const popupProps = computed(() => ({
  ...props.popupProps,
  onKeydown: withEscapeFocus(props.popupProps?.onKeydown),
}))
const subContentProps = computed(() => ({
  ...props.subContentProps,
  popupProps: {
    ...props.subContentProps?.popupProps,
    onKeydown: withEscapeFocus(props.subContentProps?.popupProps?.onKeydown),
  },
}))

const listeners = useForwardListeners(emit)

const slotNames = computed(() => keysOf(slots).filter((key) => key !== 'more-trigger'))

const ui = computed(() => treeNavVariants({ size: props.size }, props.ui, { root: props.class }))

provideTreeNavUi(ui)
provideMenuUi(() => props)
</script>

<template>
  <TreeNavCompact
    v-bind="forwardedProps"
    :items="items"
    :popup-props="popupProps"
    :sub-content-props="subContentProps"
    v-on="listeners"
  >
    <template #more-trigger="entry">
      <slot name="more-trigger" :label="entry.label" :icon="entry.icon" />
    </template>
    <template v-for="slotName in slotNames" :key="slotName" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps" />
    </template>
  </TreeNavCompact>
</template>
