<script setup lang="ts">
import { toastVariants } from '#ui/styles/toast'
import { useOmitProps } from '@vean/aria/composables'
import { ToastProvider, provideToastUi } from '@vean/aria/toast'
import { computed } from 'vue'

import type { ToastProviderProps } from './types'

defineOptions({
  name: 'SToastProvider',
})

const props = withDefaults(defineProps<ToastProviderProps>(), {
  showIcon: true,
  showClose: true,
})

const forwardedProps = useOmitProps(props, ['size', 'ui'])

const ui = computed(() =>
  toastVariants(
    {
      size: props.size,
    },
    props.ui,
  ),
)

provideToastUi(ui)
</script>

<template>
  <ToastProvider v-bind="forwardedProps">
    <slot />
  </ToastProvider>
</template>
