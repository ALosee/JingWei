<script setup lang="ts">
import { Button as HeadlessButton } from '@soybeanjs/headless/button'
import { computed } from 'vue'

import { buttonVariants } from './button.variants.js'
import type { ButtonEmits, ButtonProps } from './types.js'

const props = withDefaults(defineProps<ButtonProps>(), {
  color: 'primary',
  disabled: false,
  loading: false,
  size: 'md',
  type: 'button',
  variant: 'solid',
})
const emit = defineEmits<ButtonEmits>()

const disabled = computed(() => props.disabled || props.loading)
const classes = computed(() =>
  buttonVariants({ color: props.color, size: props.size, variant: props.variant }, props.class),
)
</script>

<template>
  <HeadlessButton
    :aria-busy="loading"
    :class="classes"
    :data-loading="loading ? '' : undefined"
    :disabled="disabled"
    :type="type"
    @click="emit('click', $event)"
  >
    <span
      v-if="loading"
      aria-hidden="true"
      class="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
    <slot />
  </HeadlessButton>
</template>
