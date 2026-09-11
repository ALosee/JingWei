<script setup lang="ts">
import { popoverVariants } from '#ui/styles/popover'
import { useForwardListeners, useOmitProps } from '@soybeanjs/headless/composables'
import { PopoverCompact, providePopoverUi } from '@soybeanjs/headless/popover'
import { keysOf } from '@soybeanjs/utils'
import { computed } from 'vue'

import type { PopoverEmits, PopoverProps, PopoverSlots } from './types'

defineOptions({ name: 'SPopover' })

const props = withDefaults(defineProps<PopoverProps>(), {
  open: undefined,
  defaultOpen: false,
  showArrow: true,
})
const emit = defineEmits<PopoverEmits>()
const slots = defineSlots<PopoverSlots>()
const forwardedProps = useOmitProps(props, ['class', 'ui', 'size'])
const listeners = useForwardListeners(emit)
const slotNames = computed(() => keysOf(slots))
const ui = computed(() => popoverVariants({ size: props.size }, props.ui, { popup: props.class }))

providePopoverUi(ui)
</script>

<template>
  <PopoverCompact v-bind="forwardedProps" v-on="listeners">
    <template v-for="slotName in slotNames" :key="slotName" #[slotName]="slotProps">
      <!-- @vue-ignore Headless owns the discriminated slot props. -->
      <slot :name="slotName" v-bind="slotProps" />
    </template>
  </PopoverCompact>
</template>
