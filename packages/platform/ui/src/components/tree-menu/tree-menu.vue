<script setup lang="ts">
import { menuVariants } from '#ui/styles/menu'
import { treeMenuVariants } from '#ui/styles/tree-menu'
import { useForwardListeners, useOmitProps } from '@soybeanjs/headless/composables'
import { provideMenuUi } from '@soybeanjs/headless/menu'
import { TreeMenuCompact, provideTreeMenuUi } from '@soybeanjs/headless/tree-menu'
import { keysOf } from '@soybeanjs/utils'
import { computed } from 'vue'

import type { TreeMenuEmits, TreeMenuProps, TreeMenuSlots } from './types'

defineOptions({ name: 'STreeMenu' })

const props = withDefaults(defineProps<TreeMenuProps>(), { collapsed: undefined })
const emit = defineEmits<TreeMenuEmits>()
const slots = defineSlots<TreeMenuSlots>()
const forwardedProps = useOmitProps(props, ['class', 'size', 'ui'])
const listeners = useForwardListeners(emit)
const slotNames = computed(() => keysOf(slots))
const ui = computed(() => treeMenuVariants({ size: props.size }, props.ui, { root: props.class }))
const menuUi = computed(() => menuVariants({ size: props.size }))

provideMenuUi(menuUi)
provideTreeMenuUi(ui)
</script>

<template>
  <TreeMenuCompact v-bind="forwardedProps" v-on="listeners">
    <template v-for="slotName in slotNames" #[slotName]="slotProps">
      <!-- @vue-ignore Headless owns the recursive slot props. -->
      <slot :name="slotName" v-bind="slotProps" />
    </template>
  </TreeMenuCompact>
</template>
