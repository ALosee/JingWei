<script setup lang="ts">
withDefaults(
  defineProps<{
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  }>(),
  { disabled: false, type: 'button' },
)
</script>

<template>
  <button
    class="jw-button"
    :disabled="disabled"
    :type="type"
  >
    <slot />
  </button>
</template>
