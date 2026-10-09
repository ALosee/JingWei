<script setup lang="ts" generic="T extends DefinedValue = DefinedValue">
import { useForwardListeners, useOmitProps } from '@vean/aria/composables'
import { DropdownMenuCompact } from '@vean/aria/dropdown-menu'
import { keysOf } from '@vean/aria/shared'
import type { DefinedValue } from '@vean/aria/types'
import { computed } from 'vue'

import { provideMenuUi } from '../menu/context'
import type { DropdownMenuProps, DropdownMenuEmits, DropdownMenuSlots } from './types'

defineOptions({
  name: 'SDropdownMenu',
})

const props = withDefaults(defineProps<DropdownMenuProps>(), {
  open: undefined,
  modal: true,
})

const emit = defineEmits<DropdownMenuEmits>()

const slots = defineSlots<DropdownMenuSlots>()

const forwardedProps = useOmitProps(props, ['class', 'size', 'ui'])

const listeners = useForwardListeners(emit)

const slotNames = computed(() => keysOf(slots).filter((key) => key !== 'trigger'))

provideMenuUi(() => props)
</script>

<template>
  <DropdownMenuCompact v-bind="forwardedProps" v-on="listeners">
    <template #trigger>
      <slot name="trigger" />
    </template>
    <template v-for="slotName in slotNames" :key="slotName" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps" />
    </template>
  </DropdownMenuCompact>
</template>
