<script setup lang="ts">
import { menuVariants } from '#ui/styles/menu'
import { useForwardListeners, useOmitProps } from '@soybeanjs/headless/composables'
import { DropdownMenuCompact } from '@soybeanjs/headless/dropdown-menu'
import { provideMenuUi } from '@soybeanjs/headless/menu'
import { keysOf } from '@soybeanjs/utils'
import { computed } from 'vue'

import type { DropdownMenuEmits, DropdownMenuProps, DropdownMenuSlots } from './types'

defineOptions({ name: 'SDropdownMenu' })

const props = withDefaults(defineProps<DropdownMenuProps<string>>(), {
  open: undefined,
  defaultOpen: false,
  showArrow: true,
  trigger: 'click',
  modal: true,
})
const emit = defineEmits<DropdownMenuEmits<string>>()
const slots = defineSlots<DropdownMenuSlots<string>>()
const forwardedProps = useOmitProps(props, ['class', 'size', 'ui'])
const listeners = useForwardListeners(emit)
const slotNames = computed(() => keysOf(slots))
const menuUi = computed(() => menuVariants({ size: props.size }, props.ui, { popup: props.class }))

provideMenuUi(menuUi)
</script>

<template>
  <DropdownMenuCompact v-bind="forwardedProps" v-on="listeners">
    <template v-for="slotName in slotNames" :key="slotName" #[slotName]="slotProps">
      <!-- @vue-ignore Headless owns the discriminated slot props. -->
      <slot :name="slotName" v-bind="slotProps" />
    </template>
  </DropdownMenuCompact>
</template>
