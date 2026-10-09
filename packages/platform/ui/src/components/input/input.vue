<script setup lang="ts">
import { inputVariants } from '#ui/styles/input'
import { useOmitProps } from '@vean/aria/composables'
import { InputCompact, provideInputUi } from '@vean/aria/input'
import { keysOf } from '@vean/aria/shared'
import { computed } from 'vue'

import type { InputProps, InputEmits, InputSlots } from './types'

defineOptions({
  name: 'SInput',
})

const props = defineProps<InputProps>()

const emit = defineEmits<InputEmits>()

const forwardedProps = useOmitProps(props, ['class', 'size', 'ui'])

const slots = defineSlots<InputSlots>()

const slotNames = computed(() => keysOf(slots))

const ui = computed(() => inputVariants({ size: props.size }, props.ui, { root: props.class }))

provideInputUi(ui)
</script>

<template>
  <InputCompact v-bind="forwardedProps" @update:model-value="emit('update:modelValue', $event)">
    <template v-for="slotName in slotNames" :key="slotName" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps" />
    </template>
  </InputCompact>
</template>
