<script setup lang="ts" generic="T extends AcceptableBooleanValue = AcceptableBooleanValue">
import { useForwardListeners, useOmitProps } from '@vean/aria/composables'
import { DropdownMenuRadioCompact } from '@vean/aria/dropdown-menu'
import { keysOf } from '@vean/aria/shared'
import type { AcceptableBooleanValue } from '@vean/aria/types'
import { computed } from 'vue'

import { provideMenuUi } from '../menu/context'
import type {
  DropdownMenuRadioProps,
  DropdownMenuRadioEmits,
  DropdownMenuRadioSlots,
} from './types'

defineOptions({
  name: 'SDropdownMenuRadio',
})

const props = withDefaults(defineProps<DropdownMenuRadioProps>(), {
  open: undefined,
  modal: true,
  modelValue: undefined,
})

const emit = defineEmits<DropdownMenuRadioEmits>()

const slots = defineSlots<DropdownMenuRadioSlots>()

const forwardedProps = useOmitProps(props, ['class', 'size', 'ui', 'indicatorPosition'])

const listeners = useForwardListeners(emit)

const slotNames = computed(() => keysOf(slots).filter((key) => key !== 'trigger'))

provideMenuUi(() => props)
</script>

<template>
  <DropdownMenuRadioCompact v-bind="forwardedProps" v-on="listeners">
    <template #trigger>
      <slot name="trigger" />
    </template>
    <template v-for="slotName in slotNames" :key="slotName" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps" />
    </template>
  </DropdownMenuRadioCompact>
</template>
