<script setup lang="ts">
import { sliderVariants } from '#ui/styles/slider'
import { useForwardListeners, useOmitProps } from '@soybeanjs/headless/composables'
import { SliderCompact, provideSliderUi } from '@soybeanjs/headless/slider'
import { computed } from 'vue'

import type { SliderProps, SliderEmits, SliderSlots } from './types'

defineOptions({
  name: 'SSlider',
})

const props = defineProps<SliderProps>()

const emit = defineEmits<SliderEmits>()

const slots = defineSlots<SliderSlots>()

const listeners = useForwardListeners(emit)

const forwardedProps = useOmitProps(props, ['class', 'color', 'size', 'ui'])

const ui = computed(() =>
  sliderVariants(
    {
      color: props.color,
      size: props.size,
    },
    props.ui,
    { root: props.class },
  ),
)

provideSliderUi(ui)
</script>

<template>
  <SliderCompact v-bind="forwardedProps" v-on="listeners">
    <template v-if="slots.default" #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </SliderCompact>
</template>
