<script setup lang="ts">
import { tabsVariants } from '#ui/styles/tabs'
import { useForwardListeners, useOmitProps } from '@soybeanjs/headless/composables'
import { TabsCompact, provideTabsUi } from '@soybeanjs/headless/tabs'
import { keysOf } from '@soybeanjs/utils'
import { computed } from 'vue'

import type { TabsProps, TabsEmits, TabsSlots } from './types'

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

const emit = defineEmits<TabsEmits>()

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
