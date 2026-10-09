<script setup lang="ts" generic="T extends TreeMenuBaseOptionData = TreeMenuBaseOptionData">
import { treeMenuVariants } from '#ui/styles/tree-menu'
import { themeSizeMap, themeSizeRatio } from '#ui/theme'
import { useForwardListeners, useOmitProps } from '@vean/aria/composables'
import { keysOf } from '@vean/aria/shared'
import { TreeMenuCompact, provideTreeMenuUi } from '@vean/aria/tree-menu'
import type { TreeMenuBaseOptionData } from '@vean/aria/tree-menu'
import { computed } from 'vue'

import { provideMenuUi } from '../menu/context'
import type { TreeMenuProps, TreeMenuEmits, TreeMenuSlots } from './types'

defineOptions({
  name: 'STreeMenu',
})

const props = withDefaults(defineProps<TreeMenuProps>(), {
  size: 'md',
  collapsed: undefined,
})

const emit = defineEmits<TreeMenuEmits>()

const slots = defineSlots<TreeMenuSlots>()

const forwardedProps = useOmitProps(props, ['class', 'size', 'ui', 'pxToRem'])

const listeners = useForwardListeners(emit)

const slotNames = computed(() => keysOf(slots))

const ui = computed(() => treeMenuVariants({ size: props.size }, props.ui, { root: props.class }))

const pxToRem = (px: number) => {
  if (props.pxToRem) {
    return props.pxToRem(px)
  }

  return (px * themeSizeRatio[props.size]) / themeSizeMap.md
}

provideMenuUi(() => ({
  size: props.size,
}))
provideTreeMenuUi(ui)
</script>

<template>
  <TreeMenuCompact v-bind="forwardedProps" :px-to-rem="pxToRem" v-on="listeners">
    <template v-for="slotName in slotNames" #[slotName]="slotProps">
      <!-- @vue-expect-error ignore slot type -->
      <slot :name="slotName" v-bind="slotProps" />
    </template>
  </TreeMenuCompact>
</template>
