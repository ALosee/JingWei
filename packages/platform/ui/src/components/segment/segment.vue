<script setup lang="ts" generic="T extends SegmentOptionData = SegmentOptionData">
import { segmentVariants } from '#ui/styles/segment'
import { useForwardListeners, useOmitProps } from '@vean/aria/composables'
import {
  provideSegmentUi,
  SegmentRoot,
  SegmentList,
  SegmentTrigger,
  SegmentIndicator,
} from '@vean/aria/segment'
import { computed } from 'vue'

import type { SegmentProps, SegmentEmits, SegmentSlots, SegmentOptionData } from './types'

defineOptions({
  name: 'SSegment',
})

const props = withDefaults(defineProps<SegmentProps<T>>(), {
  modelValue: undefined,
  unmountOnHide: true,
  loop: true,
  fill: 'auto',
  enableIndicator: true,
  disabled: false,
})

const emit = defineEmits<SegmentEmits<T['value']>>()

defineSlots<SegmentSlots>()

const forwardedProps = useOmitProps(props, [
  'class',
  'size',
  'ui',
  'fill',
  'shape',
  'items',
  'enableIndicator',
  'listProps',
  'triggerProps',
  'indicatorProps',
  'disabled',
])

const listeners = useForwardListeners(emit)

const ui = computed(() =>
  segmentVariants(
    {
      size: props.size,
      orientation: props.orientation,
      shape: props.shape,
      fill: props.fill,
      enableIndicator: props.enableIndicator,
    },
    props.ui,
    { root: props.class },
  ),
)

provideSegmentUi(ui)
</script>

<template>
  <SegmentRoot v-bind="forwardedProps" v-on="listeners">
    <SegmentList v-bind="listProps">
      <SegmentTrigger
        v-for="item in items"
        :key="String(item.value)"
        v-bind="triggerProps"
        :value="item.value"
        :disabled="disabled || item.disabled"
        :aria-disabled="disabled || item.disabled || undefined"
      >
        <template #default="slotProps"
          ><slot name="item" v-bind="{ ...item, ...slotProps }">{{ item.label }}</slot></template
        >
      </SegmentTrigger>
      <SegmentIndicator v-if="enableIndicator" v-bind="indicatorProps">
        <slot name="indicator"><div :class="ui.indicatorContent" /></slot>
      </SegmentIndicator>
    </SegmentList>
  </SegmentRoot>
</template>
