<script setup lang="ts" generic="T extends SplitNavBaseOptionData = SplitNavBaseOptionData">
import { splitNavVariants } from '#ui/styles/split-nav'
import { treeMenuVariants } from '#ui/styles/tree-menu'
import { treeNavVariants } from '#ui/styles/tree-nav'
import { useForwardListeners, useOmitProps } from '@vean/aria/composables'
import { keysOf } from '@vean/aria/shared'
import { SplitNavRoot, provideSplitNavUi } from '@vean/aria/split-nav'
import type { SplitNavBaseOptionData } from '@vean/aria/split-nav'
import { provideTreeMenuUi } from '@vean/aria/tree-menu'
import { provideTreeNavUi } from '@vean/aria/tree-nav'
import { computed, renderSlot, useAttrs, useSlots } from 'vue'

import { provideMenuUi } from '../menu/context'
import type { SplitNavProps, SplitNavEmits, SplitNavSlots } from './types'

defineOptions({
  name: 'SSplitNav',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<SplitNavProps>(), {
  mode: 'dual-vertical',
  collapsed: undefined,
})

const emit = defineEmits<SplitNavEmits>()

const slots = defineSlots<SplitNavSlots>()
const runtimeSlots = useSlots()
const ForwardSlot = (props: { name: string; scope: object }) =>
  renderSlot(runtimeSlots, props.name, { ...props.scope })

const attrs = useAttrs()

const forwardedProps = useOmitProps(props, ['class', 'size', 'ui'], attrs)

const listeners = useForwardListeners(emit)

const slotNames = computed(() => keysOf(slots))

const ui = computed(() =>
  splitNavVariants({ size: props.size }, props.ui, { verticalPane: props.class }),
)

const treeUi = computed(() => treeMenuVariants({ size: props.size }))

const treeNavUi = computed(() => treeNavVariants({ size: props.size }, { root: 'w-full' }))

provideSplitNavUi(ui)
provideTreeMenuUi(treeUi)
provideTreeNavUi(treeNavUi)
provideMenuUi(() => ({ size: props.size }))
</script>

<template>
  <SplitNavRoot v-bind="forwardedProps" v-on="listeners">
    <template v-for="slotName in slotNames" :key="slotName" #[slotName]="slotProps">
      <ForwardSlot :name="slotName" :scope="slotProps" />
    </template>
  </SplitNavRoot>
</template>
