<script setup lang="ts">
import { inputVariants } from '#ui/styles/input'
import { useOmitProps } from '@soybeanjs/headless/composables'
import { InputCompact, provideInputUi } from '@soybeanjs/headless/input'
import { keysOf } from '@soybeanjs/utils'
import { computed } from 'vue'

import type { InputProps, InputEmits, InputSlots } from './types'

defineOptions({
  name: 'SInput',
})

const props = defineProps<InputProps>()

const emit = defineEmits<InputEmits>()

const forwardedProps = useOmitProps(props, ['class', 'size', 'ui', 'rootProps'])

const slots = defineSlots<InputSlots>()

const slotNames = computed(() => keysOf(slots))

const ui = computed(() => inputVariants({ size: props.size }, props.ui, { root: props.class }))

/** Clear control only reveals when the field actually holds a value. */
const rootProps = computed(() => {
  const value = props.modelValue
  const hasValue = typeof value === 'string' && value.length > 0
  return {
    ...props.rootProps,
    'data-has-value': hasValue ? 'true' : undefined,
  }
})

provideInputUi(ui)
</script>

<template>
  <InputCompact
    v-bind="forwardedProps"
    :root-props="rootProps"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-for="slotName in slotNames" :key="slotName" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps" />
    </template>
  </InputCompact>
</template>
