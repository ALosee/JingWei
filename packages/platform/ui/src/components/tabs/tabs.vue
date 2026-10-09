<script setup lang="ts" generic="T extends TabsOptionData = TabsOptionData">
import { tabsVariants } from '#ui/styles/tabs'
import { useForwardListeners, useOmitProps } from '@vean/aria/composables'
import { keysOf } from '@vean/aria/shared'
import { TabsCompact, provideTabsUi } from '@vean/aria/tabs'
import { computed } from 'vue'

import type { TabsProps, TabsEmits, TabsSlots, TabsOptionData } from './types'

defineOptions({
  name: 'STabs',
})

const props = withDefaults(defineProps<TabsProps>(), {
  modelValue: undefined,
  unmountOnHide: true,
  fill: 'full',
  loop: true,
  enableIndicator: true,
})

const emit = defineEmits<TabsEmits<T['value']>>()

const slots = defineSlots<TabsSlots>()

const forwardedProps = useOmitProps(props, ['class', 'size', 'ui', 'fill', 'shape'])

const listeners = useForwardListeners(emit)
const slotNames = computed(() => keysOf(slots))

const ui = computed(() =>
  tabsVariants(
    {
      size: props.size,
      orientation: props.orientation,
      fill: props.fill,
      enableIndicator: props.enableIndicator,
      shape: props.shape,
    },
    props.ui,
    { root: props.class },
  ),
)

provideTabsUi(ui)
</script>

<template>
  <TabsCompact v-bind="forwardedProps" :items="items" v-on="listeners">
    <template v-for="slotName in slotNames" #[slotName]="slotProps">
      <!-- @vue-ignore ignore vue slot props type -->
      <slot :name="slotName" v-bind="slotProps" />
    </template>
  </TabsCompact>
</template>
